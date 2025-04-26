  ```env
  PORT=5001 # Port for the backend (make sure it's free)
  MONGO_URI=mongodb://localhost:27017/chatbot_gemini # Your MongoDB connection string
  JWT_SECRET=your_super_strong_and_secret_jwt_key_12345! # A strong, random secret key for JWT
  GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY_HERE # Your actual Gemini API Key
  ```
  *   **MONGO_URI:**
      *   For local MongoDB: `mongodb://localhost:27017/chatbot_gemini` (or your chosen DB name).
      *   For MongoDB Atlas: Get the connection string from your Atlas cluster (replace `<password>` and specify your database name). Example: `mongodb+srv://<username>:<password>@yourcluster.mongodb.net/chatbot_gemini?retryWrites=true&w=majority`
  *   **JWT_SECRET:** Generate a strong random string for security.
  *   **GEMINI_API_KEY:** Paste the key you obtained from Google AI Studio.
