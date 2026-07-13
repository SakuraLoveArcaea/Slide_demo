import type {SensorKey} from "./sensorData.ts";
export type slidePath = SensorKey | SensorKey[]
export type slidePaths = slidePath[]
export type wifiSlidePaths = slidePaths[] //

export type TaskType = "Active" | "Released";

export interface GameTask {
    id: number; key: SensorKey | SensorKey[]; type: TaskType; label: string;
    done: boolean; autoCompleted: boolean;
}


export const slidePath: Record<string, slidePaths> = { //  | wifiSlidePaths
    "1>4": ["A1","A2","A3","A4"],
    "1>5": ["A1","A2","A3","A4","A5"],
    "1>6": ["A1","A2","A3","A4","A5","A6"],
    "1>7": ["A1","A2","A3","A4","A5","A6","A7"],
    "1>8": ["A1","A2","A3","A4","A5","A6","A7","A8"],
    "1V35": ["A1",["A2", "B2"], "A3", ["A4","B4"], "A5"],
    "1V36": ["A1",["A2", "B2"], "A3", "B4", "B5", "A6"],
    "1V37": ["A1", ["A2", "B2"], "A3", "B3", ["C1", "C2"], "B7", "A7"],
    "4q8": ["A4","B5","B6","B7","A8"],
    "4qq8": ["A4", "B4", ["C1", "C2"], "B1", "A2", "A3", "B4", ["C1", "C2"], "B8", "A8"],
    "1-3": ["A1",["A2", "B2"], "A3"],
    "1-4-7": ["A1", "B2", "B3", "A4", "B5", "B6", "A7"],
    // "1w5": [["A1", "B8", "B7", ["A6", "D6"]], ["A1", "B1", ["C1", "C2"], ["B5", "A5"]], ["A1", "B2", "B3", ["A4", "D5"]]]
};

export const pathToGameTask = (path: slidePaths): GameTask[] => {
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

// 處理slide的多重gametask問題
