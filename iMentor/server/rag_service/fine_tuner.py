# server/rag_service/fine_tuner.py
import os
import torch
import subprocess
import logging
import tempfile
import shutil
from datetime import datetime
import requests
from unsloth import FastLanguageModel
from transformers import TrainingArguments
from trl import SFTTrainer
from datasets import load_dataset

logger = logging.getLogger(__name__)

# --- Configuration ---
# We always start from a fresh, known-good base model for each fine-tuning run.
BASE_MODEL = "unsloth/llama-3-8b-Instruct-bnb-4bit" 
# This is the temporary directory where the trained model will be saved before being imported into Ollama.
TEMP_MODEL_DIR = "/tmp/ai-tutor-model"

def format_prompts(examples):
    """
    Formats the dataset examples into the Llama-3 instruction chat template.
    This is crucial for the model to understand the data correctly.
    """
    instructions = examples["instruction"]
    outputs = examples["output"]
    texts = []
    for instruction, output in zip(instructions, outputs):
        # This structure is the specific chat template for Llama 3 Instruct models
        text = f"""<|start_header_id|>user<|end_header_id|>

{instruction}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{output}<|eot_id|>"""
        texts.append(text)
    return {"text": texts}

def report_status_to_nodejs(job_id, status, error_message=None):
    """Sends the final status of the job back to the Node.js backend."""
    node_server_url = os.getenv("NODE_SERVER_URL_FOR_CALLBACK", "http://localhost:5001")
    update_url = f"{node_server_url}/api/admin/finetuning/update-status"
    
    payload = {
        "jobId": job_id,
        "status": status,
        "errorMessage": error_message
    }
    
    try:
        # This is a fire-and-forget request. We don't wait for the response.
        requests.post(update_url, json=payload, timeout=5)
        logger.info(f"Reported status '{status}' for job '{job_id}' to Node.js.")
    except requests.exceptions.RequestException as e:
        logger.error(f"CRITICAL: Failed to report status for job '{job_id}' back to Node.js. Error: {e}")

def run_fine_tuning(dataset_path: str, model_tag_to_update: str, job_id: str):
    """
    The main function that orchestrates the entire fine-tuning process.
    """
    logger.info(f"--- Starting Fine-Tuning Job {job_id} for model tag: {model_tag_to_update} ---")
    logger.info(f"Dataset path: {dataset_path}")

    try:
        # 1. Load the dataset from the path provided by the Node.js orchestrator
        logger.info(f"Step 1/7: Loading dataset for job {job_id}...")
        dataset = load_dataset("json", data_files={"train": dataset_path}, split="train")

        # 2. Load the base model and tokenizer using unsloth for high efficiency
        logger.info(f"Step 2/7: Loading base model '{BASE_MODEL}'...")
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=BASE_MODEL,
            max_seq_length=2048,
            dtype=None,
            load_in_4bit=True,
        )

        # 3. Apply PEFT (LoRA) adapters to the model
        logger.info(f"Step 3/7: Applying PEFT (LoRA) adapters...")
        model = FastLanguageModel.get_peft_model(
            model,
            r=16,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            lora_alpha=16,
            lora_dropout=0,
            bias="none",
            use_gradient_checkpointing="unsloth",
            random_state=42,
            max_seq_length=2048,
        )

        # 4. Format the dataset using the Llama 3 chat template
        logger.info("Step 4/7: Formatting dataset...")
        formatted_dataset = dataset.map(format_prompts, batched=True)

        # 5. Set up and run the training process
        logger.info("Step 5/7: Configuring and starting the SFT trainer...")
        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=formatted_dataset,
            dataset_text_field="text",
            max_seq_length=2048,
            args=TrainingArguments(
                per_device_train_batch_size=2,
                gradient_accumulation_steps=4,
                warmup_steps=10,
                num_train_epochs=3,
                learning_rate=2e-5,
                fp16=not torch.cuda.is_bf16_supported(),
                bf16=torch.cuda.is_bf16_supported(),
                logging_steps=1,
                optim="adamw_8bit",
                weight_decay=0.01,
                lr_scheduler_type="linear",
                seed=42,
                output_dir="outputs",
            ),
        )
        trainer.train()
        logger.info("Training complete.")

        # 6. Save the fine-tuned model to a temporary GGUF file for Ollama
        logger.info(f"Step 6/7: Saving fine-tuned model to temporary directory: {TEMP_MODEL_DIR}")
        if os.path.exists(TEMP_MODEL_DIR):
            shutil.rmtree(TEMP_MODEL_DIR)
        os.makedirs(TEMP_MODEL_DIR)
        
        model.save_pretrained_gguf(TEMP_MODEL_DIR, tokenizer, quantization_method="q4_k_m")
        
        # 7. Create a Modelfile and use the `ollama create` command to update the model tag
        logger.info(f"Step 7/7: Creating Modelfile and updating Ollama model tag '{model_tag_to_update}'...")
        modelfile_content = f"FROM ./ggml-model-q4_k_m.gguf"
        modelfile_path = os.path.join(TEMP_MODEL_DIR, "Modelfile")
        with open(modelfile_path, 'w') as f:
            f.write(modelfile_content)
            
        ollama_command = ["ollama", "create", model_tag_to_update, "-f", modelfile_path]
        
        process = subprocess.run(ollama_command, capture_output=True, text=True)
        
        if process.returncode != 0:
            logger.error(f"Ollama create command failed! Stderr: {process.stderr}")
            raise RuntimeError(f"Ollama create failed: {process.stderr}")

        logger.info(f"Ollama create command successful. Model tag '{model_tag_to_update}' has been updated.")
        
        report_status_to_nodejs(job_id, "completed")
        
    except Exception as e:
        logger.error(f"An error occurred during the fine-tuning process for job {job_id}: {e}", exc_info=True)
        report_status_to_nodejs(job_id, "failed", str(e))
        raise
    finally:
        logger.info(f"Cleaning up temporary model files for job {job_id}.")
        if os.path.exists(TEMP_MODEL_DIR):
            shutil.rmtree(TEMP_MODEL_DIR)
        logger.info(f"--- Fine-Tuning Job {job_id} Finished ---")