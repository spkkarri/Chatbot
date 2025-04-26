import sys
from langchain_ollama import OllamaEmbeddings, ChatOllama

# Configuration (adjust these if your setup differs)
OLLAMA_BASE_URL = "http://localhost:11434"
EMBEDDINGS_MODEL = "mxbai-embed-large"
LLM_MODEL = "deepseek-r1"

def check_embeddings():
    """Tests if the embeddings model is served by Ollama."""
    print(f"\nTesting embeddings model: {EMBEDDINGS_MODEL}")
    try:
        embeddings = OllamaEmbeddings(
            model=EMBEDDINGS_MODEL,
            base_url=OLLAMA_BASE_URL
        )
        test_text = "This is a test sentence."
        embedding = embeddings.embed_query(test_text)
        print(f"Embeddings test successful!")
        print(f"Embedding length: {len(embedding)}")
        print(f"First 5 values: {embedding[:5]}")
        return True
    except Exception as e:
        print(f"Embeddings test failed: {e}")
        return False

def check_llm():
    """Tests if the LLM model is served by Ollama."""
    print(f"\nTesting LLM model: {LLM_MODEL}")
    try:
        llm = ChatOllama(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL
        )
        response = llm.invoke("Say 'Hello, world!'")
        print(f"LLM test successful!")
        print(f"Response: {response}")
        return True
    except Exception as e:
        print(f"LLM test failed: {e}")
        return False

def main():
    print("Checking Ollama server connectivity and model availability...")
    
    # Run tests
    embeddings_ok = check_embeddings()
    llm_ok = check_llm()

    # Summary
    print("\nSummary:")
    if embeddings_ok and llm_ok:
        print("All tests passed! Ollama is serving both embeddings and LLM models correctly.")
        sys.exit(0)
    else:
        print("One or more tests failed. Check the Ollama server and model availability.")
        sys.exit(1)

if __name__ == "__main__":
    main()