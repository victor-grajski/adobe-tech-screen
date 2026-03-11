import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  falKey: string;
  cloudinaryUrl: string | undefined;
}

export function loadConfig(): AppConfig {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY environment variable is required. See .env.example");
  }

  return {
    falKey,
    cloudinaryUrl: process.env.CLOUDINARY_URL,
  };
}
