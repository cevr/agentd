import { Schema } from "effect";

export class AgentdError extends Schema.TaggedErrorClass<AgentdError>()("@cvr/agentd/AgentdError", {
  message: Schema.String,
  code: Schema.String,
}) {}
