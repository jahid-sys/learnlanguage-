import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage, createTestFile } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let authToken: string;
  let userId: string;
  let conversationId: string;

  // Auth setup
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    expect(authToken).toBeDefined();
    expect(userId).toBeDefined();
  });

  describe("Conversations - CRUD Flow", () => {
    // CREATE: POST /api/conversations
    test("Create conversation with required fields", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "Spanish",
          level: "beginner",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      expect(data.conversationId).toBeDefined();
      expect(data.language).toBe("Spanish");
      expect(data.level).toBe("beginner");
      expect(data.createdAt).toBeDefined();
      conversationId = data.conversationId;
    });

    // CREATE: Missing required fields
    test("Create conversation without language field returns error", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "beginner",
        }),
      });
      await expectStatus(res, 400);
    });

    test("Create conversation without level field returns error", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "Spanish",
        }),
      });
      await expectStatus(res, 400);
    });

    // CREATE: Unauthenticated request
    test("Create conversation without auth returns 401", async () => {
      const res = await api("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "French",
          level: "intermediate",
        }),
      });
      await expectStatus(res, 401);
    });

    // READ: GET /api/conversations
    test("Get user's conversations", async () => {
      const res = await authenticatedApi("/api/conversations", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      // Should contain at least the conversation we created
      const found = data.find((c: any) => c.conversationId === conversationId);
      expect(found).toBeDefined();
      expect(found.language).toBe("Spanish");
      expect(found.level).toBe("beginner");
      expect(found.createdAt).toBeDefined();
    });

    // READ: Unauthenticated request
    test("Get conversations without auth returns 401", async () => {
      const res = await api("/api/conversations");
      await expectStatus(res, 401);
    });
  });

  describe("Messages - CRUD Flow", () => {
    // CREATE: POST /api/conversations/{id}/messages
    test("Send message to conversation", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${conversationId}/messages`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Hola, ¿cómo estás?",
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.response).toBeDefined();
      expect(data.messageId).toBeDefined();
    });

    // CREATE: Missing required message field
    test("Send message without message field returns error", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${conversationId}/messages`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      await expectStatus(res, 400);
    });

    // CREATE: Unauthenticated request
    test("Send message without auth returns 401", async () => {
      const res = await api(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Test message",
          }),
        }
      );
      await expectStatus(res, 401);
    });

    // CREATE: Nonexistent conversation
    test("Send message to nonexistent conversation returns 404", async () => {
      const res = await authenticatedApi(
        "/api/conversations/00000000-0000-0000-0000-000000000000/messages",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Test message",
          }),
        }
      );
      await expectStatus(res, 404);
    });

    // READ: GET /api/conversations/{id}/messages
    test("Get messages from conversation", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${conversationId}/messages`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      // Should have at least user and AI response messages
      if (data.length > 0) {
        expect(data[0].id).toBeDefined();
        expect(data[0].role).toBeDefined();
        expect(data[0].content).toBeDefined();
        expect(data[0].createdAt).toBeDefined();
      }
    });

    // READ: Unauthenticated request
    test("Get messages without auth returns 401", async () => {
      const res = await api(
        `/api/conversations/${conversationId}/messages`
      );
      await expectStatus(res, 401);
    });

    // READ: Nonexistent conversation
    test("Get messages from nonexistent conversation returns 404", async () => {
      const res = await authenticatedApi(
        "/api/conversations/00000000-0000-0000-0000-000000000000/messages",
        authToken
      );
      await expectStatus(res, 404);
    });
  });

  describe("Conversations - Delete", () => {
    let deleteConversationId: string;

    // Setup: Create a conversation to delete
    test("Create conversation for deletion", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "German",
          level: "advanced",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      deleteConversationId = data.conversationId;
    });

    // DELETE: DELETE /api/conversations/{id}
    test("Delete conversation", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${deleteConversationId}`,
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    // DELETE: Verify conversation is deleted (404)
    test("Get deleted conversation returns 404", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${deleteConversationId}/messages`,
        authToken
      );
      await expectStatus(res, 404);
    });

    // DELETE: Unauthenticated request
    test("Delete conversation without auth returns 401", async () => {
      const res = await api(
        `/api/conversations/${conversationId}`,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 401);
    });

    // DELETE: Nonexistent conversation
    test("Delete nonexistent conversation returns 404", async () => {
      const res = await authenticatedApi(
        "/api/conversations/00000000-0000-0000-0000-000000000000",
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 404);
    });
  });

  describe("Speech-to-Text - /api/conversations/{id}/speech-to-text", () => {
    let sttConversationId: string;

    // Setup: Create a conversation for STT tests
    test("Create conversation for STT tests", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "Spanish",
          level: "intermediate",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      sttConversationId = data.conversationId;
    });

    // POST: Transcribe audio
    test("Transcribe audio with file upload", async () => {
      const form = new FormData();
      form.append("file", createTestFile("audio.wav", "audio data", "audio/wav"));
      const res = await authenticatedApi(
        `/api/conversations/${sttConversationId}/speech-to-text`,
        authToken,
        {
          method: "POST",
          body: form,
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.text).toBeDefined();
      expect(data.language).toBeDefined();
    });

    // POST: Missing file
    test("Transcribe without file returns 400", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${sttConversationId}/speech-to-text`,
        authToken,
        {
          method: "POST",
          body: new FormData(),
        }
      );
      await expectStatus(res, 400);
    });

    // POST: Unauthenticated request
    test("Transcribe without auth returns 401", async () => {
      const form = new FormData();
      form.append("file", createTestFile("audio.wav", "audio data", "audio/wav"));
      const res = await api(
        `/api/conversations/${sttConversationId}/speech-to-text`,
        {
          method: "POST",
          body: form,
        }
      );
      await expectStatus(res, 401);
    });

    // POST: Nonexistent conversation
    test("Transcribe in nonexistent conversation returns 404", async () => {
      const form = new FormData();
      form.append("file", createTestFile("audio.wav", "audio data", "audio/wav"));
      const res = await authenticatedApi(
        "/api/conversations/00000000-0000-0000-0000-000000000000/speech-to-text",
        authToken,
        {
          method: "POST",
          body: form,
        }
      );
      await expectStatus(res, 404);
    });
  });

  describe("Text-to-Speech - /api/conversations/{id}/text-to-speech", () => {
    let ttsConversationId: string;

    // Setup: Create a conversation for TTS tests
    test("Create conversation for TTS tests", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "French",
          level: "beginner",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      ttsConversationId = data.conversationId;
    });

    // POST: Generate audio from text with required fields
    test("Generate audio from text with required fields", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${ttsConversationId}/text-to-speech`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Bonjour, comment allez-vous?",
            language: "French",
          }),
        }
      );
      await expectStatus(res, 200);
      // Response is binary audio data
      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    // POST: Generate audio with optional voice parameter
    test("Generate audio with optional voice parameter", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${ttsConversationId}/text-to-speech`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Bonsoir",
            language: "French",
            voice: "female",
          }),
        }
      );
      await expectStatus(res, 200);
      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    // POST: Missing required text field
    test("Generate audio without text field returns 400", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${ttsConversationId}/text-to-speech`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: "French",
          }),
        }
      );
      await expectStatus(res, 400);
    });

    // POST: Missing required language field
    test("Generate audio without language field returns 400", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${ttsConversationId}/text-to-speech`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Bonjour",
          }),
        }
      );
      await expectStatus(res, 400);
    });

    // POST: Unauthenticated request
    test("Generate audio without auth returns 401", async () => {
      const res = await api(
        `/api/conversations/${ttsConversationId}/text-to-speech`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Bonjour",
            language: "French",
          }),
        }
      );
      await expectStatus(res, 401);
    });

    // POST: Nonexistent conversation
    test("Generate audio in nonexistent conversation returns 404", async () => {
      const res = await authenticatedApi(
        "/api/conversations/00000000-0000-0000-0000-000000000000/text-to-speech",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Test",
            language: "French",
          }),
        }
      );
      await expectStatus(res, 404);
    });
  });

  describe("Vocabulary - Get", () => {
    let vocabConversationId: string;

    // Setup: Create a conversation and send a message to potentially create vocabulary
    test("Create conversation for vocabulary tests", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "Latvian",
          level: "beginner",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      vocabConversationId = data.conversationId;
    });

    // Send a message to potentially create vocabulary items
    test("Send message to create vocabulary", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${vocabConversationId}/messages`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Teach me new words",
          }),
        }
      );
      await expectStatus(res, 200);
    });

    // READ: GET /api/vocabulary
    test("Get all user vocabulary (authenticated)", async () => {
      const res = await authenticatedApi("/api/vocabulary", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      // Check structure if items exist
      if (data.length > 0) {
        expect(data[0].id).toBeDefined();
        expect(data[0].latvianWord).toBeDefined();
        expect(data[0].englishTranslation).toBeDefined();
        expect(data[0].createdAt).toBeDefined();
      }
    });

    // READ: Unauthenticated request
    test("Get vocabulary without auth returns 401", async () => {
      const res = await api("/api/vocabulary");
      await expectStatus(res, 401);
    });

    // READ: GET /api/conversations/{id}/vocabulary
    test("Get vocabulary for conversation (authenticated)", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${vocabConversationId}/vocabulary`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    // READ: Unauthenticated request
    test("Get conversation vocabulary without auth returns 401", async () => {
      const res = await api(
        `/api/conversations/${vocabConversationId}/vocabulary`
      );
      await expectStatus(res, 401);
    });

    // READ: Nonexistent conversation
    test("Get vocabulary from nonexistent conversation returns 404", async () => {
      const res = await authenticatedApi(
        "/api/conversations/00000000-0000-0000-0000-000000000000/vocabulary",
        authToken
      );
      await expectStatus(res, 404);
    });
  });

  describe("Vocabulary - Delete", () => {
    let deleteVocabConversationId: string;
    let vocabItemToDelete: any;

    // Setup: Create conversation and send message to generate vocabulary
    test("Create conversation for vocab deletion tests", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "Portuguese",
          level: "intermediate",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      deleteVocabConversationId = data.conversationId;
    });

    test("Send message to create vocabulary for deletion", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${deleteVocabConversationId}/messages`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Quero aprender novas palavras",
          }),
        }
      );
      await expectStatus(res, 200);
    });

    test("Get vocabulary items for deletion", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${deleteVocabConversationId}/vocabulary`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      if (data.length > 0) {
        vocabItemToDelete = data[0];
      }
    });

    // DELETE: DELETE /api/vocabulary/{id}
    test("Delete vocabulary item", async () => {
      if (vocabItemToDelete) {
        const res = await authenticatedApi(
          `/api/vocabulary/${vocabItemToDelete.id}`,
          authToken,
          {
            method: "DELETE",
          }
        );
        await expectStatus(res, 200);
        const data = await res.json();
        expect(data.success).toBe(true);
      }
    });

    // DELETE: Unauthenticated request
    test("Delete vocabulary without auth returns 401", async () => {
      const res = await api(
        "/api/vocabulary/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 401);
    });

    // DELETE: Nonexistent vocabulary
    test("Delete nonexistent vocabulary returns 404", async () => {
      const res = await authenticatedApi(
        "/api/vocabulary/00000000-0000-0000-0000-000000000000",
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 404);
    });
  });

  describe("Authorization - Conversation Ownership", () => {
    let user1Token: string;
    let user1ConversationId: string;
    let user2Token: string;
    let user1VocabItem: any;

    // Setup: Create second test user
    test("Sign up second test user", async () => {
      const { token } = await signUpTestUser();
      user2Token = token;
      expect(user2Token).toBeDefined();
    });

    // Setup: Create conversation as user1
    test("User 1 creates conversation", async () => {
      const res = await authenticatedApi("/api/conversations", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "Italian",
          level: "intermediate",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      user1ConversationId = data.conversationId;
    });

    // Send a message to create vocabulary
    test("User 1 sends message to create vocabulary", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}/messages`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Insegnami parole nuove",
          }),
        }
      );
      await expectStatus(res, 200);
    });

    // Get User 1's vocabulary for later authorization tests
    test("Get User 1's vocabulary", async () => {
      const res = await authenticatedApi("/api/vocabulary", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      // Find a vocabulary item from user1ConversationId
      const user1Vocab = data.find(
        (v: any) => v.conversationId === user1ConversationId
      );
      if (user1Vocab) {
        user1VocabItem = user1Vocab;
      }
    });

    // AUTHORIZATION: User 2 should not access User 1's conversation
    test("User 2 cannot read User 1's conversation messages (403)", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}/messages`,
        user2Token
      );
      await expectStatus(res, 403);
    });

    // AUTHORIZATION: User 2 cannot send message to User 1's conversation
    test("User 2 cannot send message to User 1's conversation (403)", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}/messages`,
        user2Token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Unauthorized message",
          }),
        }
      );
      await expectStatus(res, 403);
    });

    // AUTHORIZATION: User 2 cannot delete User 1's conversation
    test("User 2 cannot delete User 1's conversation (403)", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}`,
        user2Token,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 403);
    });

    // AUTHORIZATION: User 2 cannot transcribe in User 1's conversation
    test("User 2 cannot transcribe in User 1's conversation (403)", async () => {
      const form = new FormData();
      form.append("file", createTestFile("audio.wav", "audio data", "audio/wav"));
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}/speech-to-text`,
        user2Token,
        {
          method: "POST",
          body: form,
        }
      );
      await expectStatus(res, 403);
    });

    // AUTHORIZATION: User 2 cannot generate audio in User 1's conversation
    test("User 2 cannot generate audio in User 1's conversation (403)", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}/text-to-speech`,
        user2Token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Test",
            language: "Italian",
          }),
        }
      );
      await expectStatus(res, 403);
    });

    // AUTHORIZATION: User 2 cannot access User 1's conversation vocabulary
    test("User 2 cannot access User 1's conversation vocabulary (403)", async () => {
      const res = await authenticatedApi(
        `/api/conversations/${user1ConversationId}/vocabulary`,
        user2Token
      );
      await expectStatus(res, 403);
    });

    // AUTHORIZATION: User 2 cannot delete User 1's vocabulary items
    test("User 2 cannot delete User 1's vocabulary item (403)", async () => {
      if (user1VocabItem) {
        const res = await authenticatedApi(
          `/api/vocabulary/${user1VocabItem.id}`,
          user2Token,
          {
            method: "DELETE",
          }
        );
        await expectStatus(res, 403);
      }
    });
  });
});
