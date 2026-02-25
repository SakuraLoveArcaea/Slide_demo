import type {SensorKey} from "./sensorData.ts";

export type TaskType = "Active" | "Released";

export interface GameTask {
    id: number; key: SensorKey | SensorKey[]; type: TaskType; label: string;
    done: boolean; autoCompleted: boolean;
}


export const slidePath: Record<string, (SensorKey | SensorKey[])[]> = {
    "1>4": ["A1","A2","A3","A4"],
    "1>5": ["A1","A2","A3","A4","A5"],
    "1>6": ["A1","A2","A3","A4","A5","A6"],
    "1>7": ["A1","A2","A3","A4","A5","A6","A7"],
    "1>8": ["A1","A2","A3","A4","A5","A6","A7","A8"],
    "1V35": ["A1",["A2","B2"],"A3", ["A4","B4"], "A5"],
    "4q8": ["A4","B5","B6","B7","A8"],
    "1-3": ["A1",["A2","B2"],"A3"],
};

export const pathToGameTask = (path: (SensorKey | SensorKey[])[]): GameTask[] => {
    const tasks: GameTask[] = [];
    let idCounter = 1;

    path.forEach((key, index) => {
        const isLast = index === path.length - 1;
        const keyLabel = Array.isArray(key) ? key.join(" or ") : key;

        tasks.push({
            id: idCounter++, key, type: "Active", label: `按住 ${keyLabel}`, done: false, autoCompleted: false
        });

        if (!isLast) {
            tasks.push({
                id: idCounter++, key, type: "Released", label: `放開 ${keyLabel}`, done: false, autoCompleted: false
            });
        }
    });

    return tasks;
};

// 自動動態生成所有的 slide_game_task！
export const slide_game_task: Record<string, GameTask[]> = Object.entries(slidePath).reduce((acc, [code, path]) => {
    acc[code] = pathToGameTask(path);
    return acc;
}, {} as Record<string, GameTask[]>);