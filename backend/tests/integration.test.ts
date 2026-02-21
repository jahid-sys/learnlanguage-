import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage } from "./helpers";

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

  describe("Authorization - Conversation Ownership", () => {
    let user1Token: string;
    let user1ConversationId: string;
    let user2Token: string;

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
  });
});
