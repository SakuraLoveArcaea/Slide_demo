import type {SensorKey} from "./sensorData.ts";

export type TaskType = "Active" | "Released";

export interface GameTask {
    id: number; key: SensorKey; type: TaskType; label: string;
    done: boolean; autoCompleted: boolean;
}

export const slide_game_task: Record<string, GameTask[]> = {
    '1>4': [
        { id: 1, key: "A1", type: "Active",   label: "按住 A1", done: false, autoCompleted: false },
        { id: 2, key: "A1", type: "Released", label: "放開 A1", done: false, autoCompleted: false },
        { id: 3, key: "A2", type: "Active",   label: "按住 A2", done: false, autoCompleted: false },
        { id: 4, key: "A2", type: "Released", label: "放開 A2", done: false, autoCompleted: false },
        { id: 5, key: "A3", type: "Active",   label: "再按 A3", done: false, autoCompleted: false },
        { id: 6, key: "A3", type: "Released", label: "放開 A3", done: false, autoCompleted: false },
        { id: 7, key: "A4", type: "Active",   label: "按住 A4", done: false, autoCompleted: false },
    ],
    '1>5': [
        { id: 1, key: "A1", type: "Active",   label: "按住 A1", done: false, autoCompleted: false },
        { id: 2, key: "A1", type: "Released", label: "放開 A1", done: false, autoCompleted: false },
        { id: 3, key: "A2", type: "Active",   label: "按住 A2", done: false, autoCompleted: false },
        { id: 4, key: "A2", type: "Released", label: "放開 A2", done: false, autoCompleted: false },
        { id: 5, key: "A3", type: "Active",   label: "再按 A3", done: false, autoCompleted: false },
        { id: 6, key: "A3", type: "Released", label: "放開 A3", done: false, autoCompleted: false },
        { id: 7, key: "A4", type: "Active",   label: "按住 A4", done: false, autoCompleted: false },
        { id: 8, key: "A4", type: "Released", label: "放開 A4", done: false, autoCompleted: false },
        { id: 9, key: "A5", type: "Active",   label: "按住 A5", done: false, autoCompleted: false },
    ],
//     OR logic 1V35
//     '1V35': [
        // new OR {}
        // ]
}