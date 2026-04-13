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
const kpiRepository_1 = require("./src/repositories/kpiRepository");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Testing getCanonicalFunnelCounts...");
        yield (0, kpiRepository_1.getCanonicalFunnelCounts)({ month: '2026-04' });
        console.log("SUCCESS");
        console.log("Testing getDailyApplicationTrend...");
        yield (0, kpiRepository_1.getDailyApplicationTrend)({ month: '2026-04' });
        console.log("SUCCESS");
        console.log("Testing getSalesActuals...");
        yield (0, kpiRepository_1.getSalesActuals)({ month: '2026-04' });
        console.log("SUCCESS");
        console.log("Testing getGoals...");
        yield (0, kpiRepository_1.getGoals)({ scopeType: 'global', periodType: 'monthly', month: '2026-04' });
        console.log("SUCCESS");
    }
    catch (err) {
        console.error("FAILED:");
        console.error(err);
    }
    process.exit();
}))();
