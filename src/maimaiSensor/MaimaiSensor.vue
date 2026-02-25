<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from "vue";
import { type SensorKey } from "./sensorData.ts";
import SensorRing from "./SensorRing.vue";
import { slide_game_task } from "./slide.ts";
import { type GameTask } from "./slide.ts";

// 動態取得所有可用的 slide code，供下拉選單使用
const availableSlideCodes = Object.keys(slide_game_task);

// 預設值設定為 "1>5"
const DEFAULT_SLIDE_CODE = "1>5";

// 確保初始化的值存在，否則退回預設值
const initialCode = availableSlideCodes.includes(DEFAULT_SLIDE_CODE)
    ? DEFAULT_SLIDE_CODE
    : availableSlideCodes[0] || "";

const selectSlideCode = ref(initialCode);

// 確保 tasks 初始化時也有防呆
const initialTasks = slide_game_task[selectSlideCode.value] || slide_game_task[DEFAULT_SLIDE_CODE] || [];
const tasks = reactive<GameTask[]>([...initialTasks]);

const isGameClear = ref(false);
const JUDGE_WINDOW_SIZE = 3;

// 自動重置的計時器 ID
let autoResetTimer: number | undefined;

const isLockMode = ref(false);
const isDeEnabled = ref(true);
const touchedIds = ref(new Set<SensorKey>());
const lockedIds = reactive(new Set<SensorKey>());
const finalActiveIds = computed(() => isLockMode.value ? lockedIds : touchedIds.value);

// 更新touchedIds（或activedIds）
const handleTouchUpdate = (ids: Set<SensorKey>) => { if (!isLockMode.value) touchedIds.value = ids; };

const handleSensorClick = (id: SensorKey) => {
    if (isLockMode.value) lockedIds.has(id) ? lockedIds.delete(id) : lockedIds.add(id);
};

const toggleLockMode = () => {
    isLockMode.value = !isLockMode.value;
    if (!isLockMode.value) {
        lockedIds.clear();
    }
};

const toggleDe = () => {
    isDeEnabled.value = !isDeEnabled.value;
    if (!isDeEnabled.value) [...lockedIds].forEach(id => /^[DE]/.test(id) && lockedIds.delete(id));
};

// 重置遊戲
const resetGame = () => {
    clearTimeout(autoResetTimer);
    tasks.forEach(t => { t.done = false; t.autoCompleted = false; });
    isGameClear.value = false;
};

// ==========================================
// 4. 遊戲迴圈 (Game Loop)
// ==========================================
let animationFrameId: number;
let previousActiveSet = new Set<SensorKey>();

const gameLoop = () => {
    const currentSet = new Set(finalActiveIds.value);
    const releasedKeys: SensorKey[] = [];
    previousActiveSet.forEach(id => {
        if (!currentSet.has(id)) releasedKeys.push(id);
    });
    checkGameProgress(currentSet, releasedKeys);
    previousActiveSet = currentSet;
    animationFrameId = requestAnimationFrame(gameLoop);
};

const checkGameProgress = (activeSet: Set<SensorKey>, releasedList: SensorKey[]) => {
    if (isGameClear.value) return;
    const pendingTasks: GameTask[] = tasks.filter(t => !t.done);

    if (pendingTasks.length === 0) {
        if (!isGameClear.value) {
            isGameClear.value = true;
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

            autoResetTimer = setTimeout(() => {
                resetGame();
            }, 1000);
        }
        return;
    }

    const tasksToCheck = pendingTasks.slice(0, JUDGE_WINDOW_SIZE);

    for (let i = 0; i < tasksToCheck.length; i++) {
        const task = tasksToCheck[i]!;
        let isMatch = false;

        // 將 key 統一轉成陣列格式，方便後續比對
        const targetKeys = Array.isArray(task.key) ? task.key : [task.key];

        if (task.type === "Active") {
            // OR 邏輯：只要 activeSet 包含 targetKeys 裡的「任何一個」就算符合
            if (targetKeys.some(k => activeSet.has(k))) isMatch = true;
        } else if (task.type === "Released") {
            // OR 邏輯：只要 releasedList 包含 targetKeys 裡的「任何一個」就算符合
            if (targetKeys.some(k => releasedList.includes(k))) isMatch = true;
        }

        if (isMatch) {
            task.done = true;
            task.autoCompleted = false;
            if (navigator.vibrate) navigator.vibrate(20);

            // 把被跳過的任務標記為自動完成
            for (let j = 0; j < i; j++) {
                tasksToCheck[j]!.done = true;
                tasksToCheck[j]!.autoCompleted = true;
            }
            return;
        }
    }
};

onMounted(() => { animationFrameId = requestAnimationFrame(gameLoop); });
onUnmounted(() => { cancelAnimationFrame(animationFrameId); clearTimeout(autoResetTimer); });

const isCurrent = (task: GameTask) => {
    if (task.done) return false;
    const firstPending = tasks.find(t => !t.done);
    return firstPending && task.id === firstPending.id;
};

// 監聽 selectSlideCode 改變
watch(selectSlideCode, (newCode) => {
    // 防呆：如果找不到對應的 code，退回預設值
    const newTasks = slide_game_task[newCode] || slide_game_task[DEFAULT_SLIDE_CODE] || [];

    // 使用 splice 更新陣列，保留響應性
    // 注意：因為 slide_game_task 裡的物件是被共用的，我們需要深拷貝（至少複製一層），
    // 以免多次切換後，上一次玩過的 done 狀態殘留在原物件上。
    const clonedTasks = newTasks.map(t => ({ ...t, done: false, autoCompleted: false }));
    tasks.splice(0, tasks.length, ...clonedTasks);

    resetGame();
});

const formatKey = (key: SensorKey | SensorKey[]) => {
    return Array.isArray(key) ? key.join('/') : key;
};

</script>


<template>
    <div class="app-container">


        <div class="status-board ui-layer pointer-auto">
            <div
                v-for="task in tasks"
                :key="task.id"
                class="status-chip"
                :class="{
            'chip-active': task.type === 'Active',
            'chip-released': task.type === 'Released',
            'is-done': task.done,
            'is-current': isCurrent(task),
            'is-auto': task.autoCompleted
        }"
            >
                {{ formatKey(task.key) }}{{ task.type === 'Active' ? '↓' : '↑' }}
            </div>
        </div>
        <div v-if="isGameClear" class="center-msg ui-layer pointer-events-none">
            FINISHED!
            <div class="sub-msg">Restarting in 1s...</div>
            <button @click="resetGame" class="btn-reset pointer-auto">SKIP</button>
        </div>

        <SensorRing
            :active-ids="finalActiveIds"
            :show-de="isDeEnabled"
            @update:touched="handleTouchUpdate"
            @sensor-tap="handleSensorClick"
        />

        <div class="bottom-controls ui-layer">
            <div class="control-group left">
                <button @click="toggleLockMode" class="btn-tiny pointer-auto" :class="{active: isLockMode}">
                    {{ isLockMode ? 'LOCK' : 'TOUCH' }}
                </button>
                <button @click="toggleDe" class="btn-tiny pointer-auto" :class="{active: !isDeEnabled}">
                    {{ isDeEnabled ? 'DE:ON' : 'DE:OFF' }}
                </button>
            </div>

            <div class="control-group center">
                <button @click="resetGame" class="btn-large pointer-auto">
                    RESET
                </button>
            </div>

            <div class="control-group right">
                <select class="btn-select pointer-auto" v-model="selectSlideCode">
                    <option v-for="code in availableSlideCodes" :key="code" :value="code">
                        {{ code }}
                    </option>
                </select>
            </div>
        </div>
    </div>
</template>

<style scoped>
.app-container {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #111; overflow: hidden;
    touch-action: none; user-select: none;
    display: flex; justify-content: center; align-items: center;
}
.ui-layer { position: absolute; z-index: 10; pointer-events: none; }
.pointer-auto { pointer-events: auto; }
.pointer-events-none { pointer-events: none; }

.status-board {
    top: 0; left: 0; width: 100%;
    max-height: 25vh; overflow-y: auto;
    background: rgba(0, 0, 0, 0.8);
    padding: 6px; box-sizing: border-box;
    display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4px;
}
.status-chip {
    font-size: 11px; font-family: monospace;
    padding: 3px 6px; border-radius: 3px; border: 1px solid #333;
    color: #777; background: #1a1a1a; transition: all 0.1s;
}
.chip-active { font-weight: bold; color: #aaa; }
.chip-released { font-style: italic; opacity: 0.7; }
.status-chip.is-done { background: #064e3b; color: #4ade80; border-color: #059669; opacity: 1; }
.status-chip.is-auto { opacity: 0.4; }
.status-chip.is-current {
    background: #facc15; color: #000; border-color: #fff;
    transform: scale(1.1); z-index: 2; box-shadow: 0 0 5px rgba(250, 204, 21, 0.6);
}

.center-msg {
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    text-align: center; color: #facc15; font-size: 24px; font-weight: bold; text-shadow: 0 0 10px black;
}
.sub-msg { font-size: 12px; color: #888; margin-top: 5px; font-weight: normal; }
.btn-reset {
    display: block; margin: 10px auto 0; font-size: 12px;
    background: #333; color: white; border: 1px solid #555; padding: 4px 10px; border-radius: 4px;
}

/* 底部控制列重新佈局 */
.bottom-controls {
    bottom: 10px; width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 15px;
    box-sizing: border-box;
}

.control-group {
    display: flex;
    gap: 8px; /* 群組內按鈕的間距 */
    align-items: center;
}

.control-group.left { justify-content: flex-start; flex: 1; }
.control-group.center { justify-content: center; flex: 1; }
.control-group.right { justify-content: flex-end; flex: 1; }

.btn-tiny {
    background: #333; color: #888; border: 1px solid #444; font-size: 11px; padding: 6px 10px; border-radius: 4px; cursor: pointer;
}
.btn-tiny.active { background: #444; color: #fff; border-color: #888; }

.btn-select {
    background: #333; color: #fff; border: 1px solid #555; font-size: 12px; padding: 6px 8px; border-radius: 4px; cursor: pointer; outline: none;
}

.btn-large {
    background: #991b1b;
    color: #fff;
    border: 1px solid #f87171;
    font-size: 14px;
    font-weight: bold;
    padding: 8px 24px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    cursor: pointer;
}
.btn-large:active {
    background: #7f1d1d;
    transform: translateY(1px);
}
</style>