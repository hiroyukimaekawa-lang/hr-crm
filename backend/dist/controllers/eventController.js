"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvent = exports.getEvents = void 0;
const db_1 = __importDefault(require("../config/db"));
const getEvents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.default.query('SELECT * FROM events ORDER BY event_date DESC');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getEvents = getEvents;
const createEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, event_date } = req.body;
    try {
        const result = yield db_1.default.query('INSERT INTO events (title, description, event_date) VALUES ($1, $2, $3) RETURNING *', [title, description, event_date]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createEvent = createEvent;
