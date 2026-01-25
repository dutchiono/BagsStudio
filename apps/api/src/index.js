"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const shared_1 = require("@solamma/shared");
const server = (0, fastify_1.default)({ logger: true });
server.register(cors_1.default, {
    origin: '*', // TODO: Lock down in production
});
server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date() };
});
server.get('/', async () => {
    return { message: 'Solamma API v1', role: shared_1.UserRole.USER };
});
const start = async () => {
    try {
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
