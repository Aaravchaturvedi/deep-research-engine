import { Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { prisma } from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

//const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { message, sessionId } = req.body;
    const userId = req.userId as string;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Create a new session if none provided
    let session = sessionId
      ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
      : null;

    if (!session) {
      session = await prisma.chatSession.create({
        data: { userId, title: message.slice(0, 40) },
      });
    }

    // Save the user's message
    await prisma.message.create({
      data: { sessionId: session.id, role: "user", content: message },
    });

    // // calling the Groq API to get a response from the assistant
    // const completion = await groq.chat.completions.create({
    //   model: "llama-3.3-70b-versatile",
    //   messages: [{ role: "user", content: message }],
    // });
    // const responseText =
    //   completion.choices[0].message.content ?? "No response generated.";
    // Call Gemini API
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
    });

    const result = await model.generateContent(message);

    const responseText = result.response.text() || "No response generated.";

    // Save assistant's reply
    await prisma.message.create({
      data: { sessionId: session.id, role: "assistant", content: responseText },
    });

    res.json({
      sessionId: session.id,
      reply: responseText,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get response" });
  }
}
