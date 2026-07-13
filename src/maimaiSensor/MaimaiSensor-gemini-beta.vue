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

// Canvas 參考
const slideCanvas = ref<HTMLCanvasElement | null>(null);

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

        const targetKeys = Array.isArray(task.key) ? task.key : [task.key];

        if (task.type === "Active") {
            if (targetKeys.some(k => activeSet.has(k))) isMatch = true;
        } else if (task.type === "Released") {
            if (targetKeys.some(k => releasedList.includes(k))) isMatch = true;
        }

        if (isMatch) {
            task.done = true;
            task.autoCompleted = false;
            if (navigator.vibrate) navigator.vibrate(20);

            for (let j = 0; j < i; j++) {
                tasksToCheck[j]!.done = true;
                tasksToCheck[j]!.autoCompleted = true;
            }
            return;
        }
    }
};

// ==========================================
// 5. Canvas 繪製邏輯
// ==========================================
const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    ctx.save();
    ctx.beginPath();
    const spikes = 5;
    const innerRadius = radius / 2;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - radius);
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * radius;
        let y = cy + Math.sin(rot) * radius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - radius);
    ctx.closePath();

    // 設定星星顏色 (統一 #00CED1 透明度 50%)
    ctx.fillStyle = 'rgba(0, 206, 209, 0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 206, 209, 0.8)'; // 外框稍微亮一點增加立體感
    ctx.stroke();
    ctx.restore();
};

const drawSlidePath = () => {
    const canvas = slideCanvas.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    // 匹配容器大小
    canvas.width = rect.width;
    canvas.height = rect.height;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    // 預設 MaiMai 比例：半徑約為短邊的 45%
    const R = Math.min(canvas.width, canvas.height) * 0.45;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 過濾出需要碰觸的任務來描繪路徑
    const activeTasks = tasks.filter(t => t.type === 'Active');
    if (activeTasks.length === 0) return;

    // 將 SensorKey 轉換為 Canvas 座標的輔助函數
    const getPoint = (keyStr: string) => {
        if (keyStr === 'C') return { x: cx, y: cy };
        const type = keyStr.charAt(0);
        const num = parseInt(keyStr.replace(/[^0-9]/g, '')) || 1;

        // 角度計算：1號位置從 -67.5度 開始
        let angle = -Math.PI / 2 + Math.PI / 8 + (num - 1) * (Math.PI / 4);
        if (['D', 'E'].includes(type)) {
            // D/E 的角度介於按鍵之間 (例如 D1 在正上方 -90度)
            angle = -Math.PI / 2 + (num - 1) * (Math.PI / 4);
        }

        // 半徑計算
        let r = R;
        if (type === 'B') r = R * 0.465;
        else if (type === 'E') r = R * 0.66;
        else if (type === 'D') r = R * 0.9;
        else if (type === 'A' || !isNaN(Number(type))) r = R;

        return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    };

    // 提取所有節點座標
    const points = activeTasks.map(task => {
        const keys = Array.isArray(task.key) ? task.key : [task.key];
        // 如果是多個 Key，取平均中心點
        let sumX = 0, sumY = 0;
        keys.forEach(k => {
            const p = getPoint(String(k));
            sumX += p.x; sumY += p.y;
        });
        return { x: sumX / keys.length, y: sumY / keys.length };
    });

    if (points.length < 2) return;

    // 1. 繪製軌跡
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = 'rgba(0, 206, 209, 0.5)'; // #00CED1, 50% opacity
    ctx.lineWidth = R * 0.12; // 軌跡粗細
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round'; // 讓折角變圓滑，模擬真實弧度
    ctx.stroke();

    // 2. 在起點繪製星星
    drawStar(ctx, points[0].x, points[0].y, R * 0.15);
};

onMounted(() => {
    animationFrameId = requestAnimationFrame(gameLoop);
    window.addEventListener('resize', drawSlidePath);
    // 確保 DOM 渲染完畢後繪製
    setTimeout(drawSlidePath, 50);
});
onUnmounted(() => {
    cancelAnimationFrame(animationFrameId);
    clearTimeout(autoResetTimer);
    window.removeEventListener('resize', drawSlidePath);
});

const isCurrent = (task: GameTask) => {
    if (task.done) return false;
    const firstPending = tasks.find(t => !t.done);
    return firstPending && task.id === firstPending.id;
};

// 監聽 selectSlideCode 改變
watch(selectSlideCode, (newCode) => {
    const newTasks = slide_game_task[newCode] || slide_game_task[DEFAULT_SLIDE_CODE] || [];
    const clonedTasks = newTasks.map(t => ({ ...t, done: false, autoCompleted: false }));
    tasks.splice(0, tasks.length, ...clonedTasks);

    resetGame();
    // 延遲更新以確保 tasks 已經反映到畫面並重繪
    setTimeout(drawSlidePath, 0);
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

        <canvas ref="slideCanvas" class="slide-canvas pointer-events-none"></canvas>

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

/* Canvas 層級介於 SensorRing 與 UI(10) 之間 */
.slide-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
}

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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 15px;
    box-sizing: border-box;
}

.control-group {
    display: flex;
    gap: 8px;
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