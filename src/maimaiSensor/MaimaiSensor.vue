<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { type SensorKey } from "./sensorData.ts";
import SensorRing from "./SensorRing.vue";
import { slide_game_task } from "./slide.ts"
import { type GameTask } from "./slide.ts"

// ==========================================
// 1. 定義資料結構
// ==========================================


// ==========================================
// 2. 固定任務清單
// ==========================================
const tasks = reactive<GameTask[]>(slide_game_task["1>5"]!);

const isGameClear = ref(false);
const JUDGE_WINDOW_SIZE = 3;

// 自動重置的計時器 ID
let autoResetTimer: number | undefined;

// ==========================================
// 3. Sensor 狀態與模式控制
// ==========================================
const isLockMode = ref(false);
const isDeEnabled = ref(true);
const touchedIds = ref(new Set<SensorKey>());
const lockedIds = reactive(new Set<SensorKey>());
const finalActiveIds = computed(() => isLockMode.value ? lockedIds : touchedIds.value);

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
    const pendingTasks = tasks.filter(t => !t.done);

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
        const task = tasksToCheck[i];
        let isMatch = false;
        if (task.type === "Active") {
            if (activeSet.has(task.key)) isMatch = true;
        } else if (task.type === "Released") {
            if (releasedList.includes(task.key)) isMatch = true;
        }

        if (isMatch) {
            task.done = true;
            task.autoCompleted = false;
            if (navigator.vibrate) navigator.vibrate(20);

            for (let j = 0; j < i; j++) {
                tasksToCheck[j].done = true;
                tasksToCheck[j].autoCompleted = true;
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
                {{ task.key }}{{ task.type === 'Active' ? '↓' : '↑' }}
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
            <button @click="toggleLockMode" class="btn-tiny pointer-auto" :class="{active: isLockMode}">
                {{ isLockMode ? 'LOCK' : 'TOUCH' }}
            </button>

            <button @click="resetGame" class="btn-large pointer-auto">
                RESET
            </button>

            <button @click="toggleDe" class="btn-tiny pointer-auto" :class="{active: !isDeEnabled}">
                {{ isDeEnabled ? 'DE:ON' : 'DE:OFF' }}
            </button>
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
.bottom-controls {
    bottom: 10px; width: 100%;
    display: flex; justify-content: space-between;
    align-items: center; /* 讓不同大小的按鈕垂直置中 */
    padding: 0 10px; box-sizing: border-box;
}
.btn-tiny {
    background: #333; color: #888; border: 1px solid #444; font-size: 10px; padding: 4px 8px; border-radius: 4px;
}
.btn-tiny.active { background: #444; color: #fff; border-color: #888; }

/* 新增的大按鈕樣式 */
.btn-large {
    background: #991b1b; /* 深紅色 */
    color: #fff;
    border: 1px solid #f87171;
    font-size: 14px;
    font-weight: bold;
    padding: 8px 20px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.btn-large:active {
    background: #7f1d1d;
    transform: translateY(1px);
}
</style>