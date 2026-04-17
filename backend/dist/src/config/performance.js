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
exports.applyPerformanceOptimizations = void 0;
const db_1 = __importDefault(require("./db"));
const indexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_students_staff_id ON students(staff_id)',
    'CREATE INDEX IF NOT EXISTS idx_students_source_company ON students(source_company)',
    'CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_students_dedupe ON students(name, university, faculty)',
    'CREATE INDEX IF NOT EXISTS idx_students_next_meeting_date ON students(next_meeting_date)',
    'CREATE INDEX IF NOT EXISTS idx_student_tasks_student_created ON student_tasks(student_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_student_tasks_student_due_date ON student_tasks(student_id, due_date)',
    'CREATE INDEX IF NOT EXISTS idx_student_events_event_id ON student_events(event_id)',
    'CREATE INDEX IF NOT EXISTS idx_student_events_student_id ON student_events(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_student_events_event_status ON student_events(event_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_event_dates_event_id_date ON event_dates(event_id, event_date)',
    'CREATE INDEX IF NOT EXISTS idx_interview_logs_student_created ON interview_logs(student_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_interview_schedules_student_round ON interview_schedules(student_id, round_no)',
    'CREATE INDEX IF NOT EXISTS idx_interview_schedules_student_type ON interview_schedules(student_id, schedule_type)'
];
const applyPerformanceOptimizations = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        for (const sql of indexQueries) {
            yield db_1.default.query(sql);
        }
        console.log('[performance] index optimization applied');
    }
    catch (err) {
        // DB schema might not be ready on first boot in some environments.
        console.warn('[performance] index optimization skipped:', (err === null || err === void 0 ? void 0 : err.message) || err);
    }
});
exports.applyPerformanceOptimizations = applyPerformanceOptimizations;
