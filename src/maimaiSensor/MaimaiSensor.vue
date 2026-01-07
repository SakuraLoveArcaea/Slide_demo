<script setup lang="ts">
import { ref, computed } from "vue";
// 記得這裡要改回引入完整的 sensors 資料
import { sensors } from "./sensorData.ts";

// ==========================================
// 1. 狀態管理
// ==========================================

// [Toggle 模式] 儲存點擊後的長亮狀態
const toggleStates = ref<Record<string, boolean>>({});

// [Normal 模式] 多點觸控核心 Map
const activePointers = new Map<number, string>();

// 畫面渲染用的 Set
const activeSensorIds = ref(new Set<string>());

const isToggleMode = ref<boolean>(false);
const isDEEnabled = ref<boolean>(true);

// ==========================================
// 2. 核心邏輯
// ==========================================

// --- 修改點 1: 移除 visibleSensors Computed 屬性 ---
// 我們不再需要過濾它們，因為它們都要顯示。

// --- 新增：判斷是否為禁用狀態的輔助函式 ---
const isDisabled = (id: string) => {
    // 如果開關關閉，且 ID 是 D 或 E 開頭，則為禁用
    return !isDEEnabled.value && (id.startsWith('D') || id.startsWith('E'));
};

// 輔助函式：同步 Map 到 Set
const updateActiveSensors = () => {
    const newSet = new Set<string>();
    activePointers.forEach((sensorId) => {
        if (sensorId) newSet.add(sensorId);
    });
    activeSensorIds.value = newSet;
};

// 切換模式 (Click / Touch)
const handleSwitchToggleMode = () => {
    if (isToggleMode.value) {
        for (const key in toggleStates.value) {
            toggleStates.value[key] = false;
        }
    }
    isToggleMode.value = !isToggleMode.value;
    activePointers.clear();
    updateActiveSensors();
};

// 切換 D/E 區啟用狀態
const handleToggleDE = () => {
    isDEEnabled.value = !isDEEnabled.value;

    // 如果切換為禁用，清除 D/E 區殘留的亮燈狀態
    if (!isDEEnabled.value) {
        // 清除 Toggle 模式紀錄
        Object.keys(toggleStates.value).forEach(key => {
            if (key.startsWith('D') || key.startsWith('E')) {
                toggleStates.value[key] = false;
            }
        });
        // 清除多點觸控紀錄 (簡單暴力全清，確保沒殘留)
        activePointers.clear();
        updateActiveSensors();
    }
};

// 處理點擊
const handleSensorClick = (id: string) => {
    // 注意：因為 CSS pointer-events: none 的關係，
    // 禁用狀態下的元素根本不會觸發這個 click 事件，所以這裡不用額外判斷。
    if (isToggleMode.value) {
        toggleStates.value[id] = !toggleStates.value[id];
        console.log(`Toggle sensor ${id}:`, toggleStates.value[id]);
    } else {
        console.log(`Clicked ${id} in Normal Mode`);
    }
};

// ==========================================
// 3. 多點觸控處理
// ==========================================

const handlePointerDownOrMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    if (isToggleMode.value) return;

    // elementFromPoint 會自動忽略 pointer-events: none 的元素
    // 所以禁用狀態下的 D/E 區不會被這裡抓到，完美符合需求。
    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
    const sensorId = (target?.classList.contains('sensor')) ? target.id : null;
    const pointerId = event.pointerId;

    if (sensorId) {
        const prevSensorId = activePointers.get(pointerId);
        if (prevSensorId !== sensorId) {
            activePointers.set(pointerId, sensorId);
            if (navigator.vibrate) navigator.vibrate(5);
        }
    } else {
        activePointers.delete(pointerId);
    }
    updateActiveSensors();
};

const handlePointerUpOrLeave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    activePointers.delete(event.pointerId);
    updateActiveSensors();
};

// ==========================================
// 4. 視覺計算
// ==========================================
const isSensorActive = (id: string) => {
    // 如果是禁用狀態，永遠不給亮
    if (isDisabled(id)) return false;

    if (isToggleMode.value) {
        return toggleStates.value[id];
    } else {
        return activeSensorIds.value.has(id);
    }
};
</script>

<template>
    <div class="controls">
        <button @click="handleSwitchToggleMode" class="button btn-mode">
            {{ isToggleMode ? 'Mode: Lock' : 'Mode: Touch' }}
        </button>
        <button @click="handleToggleDE" class="button btn-de">
            {{ isDEEnabled ? 'D/E: Interactive' : 'D/E: Disabled (Gray)' }}
        </button>
    </div>

    <div
        class="svg-container"
        @pointerdown="handlePointerDownOrMove"
        @pointermove="handlePointerDownOrMove"
        @pointerup="handlePointerUpOrLeave"
        @pointerleave="handlePointerUpOrLeave"
        @pointercancel="handlePointerUpOrLeave"
        @contextmenu.prevent
    >
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1440">
            <path id="background" d="M0,0 L1440,0 L1440,1440 L0,1440 z" fill="#000000" />

            <g id="sensors-container">
                <path
                    v-for="sensor in sensors"
                    :key="sensor.id"
                    :id="sensor.id"
                    :d="sensor.d"
                    :transform="sensor.transform"
                    class="sensor"
                    :class="{
                        'is-active': isSensorActive(sensor.id),
                        'is-disabled': isDisabled(sensor.id) /* 修改點 3: 綁定禁用 Class */
                    }"
                    @click="handleSensorClick(sensor.id)"
                />
            </g>
        </svg>
    </div>
</template>

<style scoped>
/* 容器與 SVG 基礎樣式保持不變 */
.svg-container {
    height: 90dvmin;
    aspect-ratio: 1 / 1;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

svg {
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
}

svg path {
    pointer-events: auto;
}

/* --- Sensor 樣式邏輯 --- */

/* 1. 預設狀態 (藍色) */
.sensor {
    fill: #000066;
    stroke: none;
    cursor: pointer;

    /* 關鍵在這裡： */
    /* 當 active class 被移除時，會看這裡的設定 -> 慢慢變回藍色 */
    transition: fill 0s ease-out;
}

/* 2. 啟動狀態 (紅色) */
/* 2. 啟動狀態 (紅色) */
.sensor.is-active {
    fill: #ff0000;

    /* 關鍵在這裡： */
    /* 當 active class 被加上時，會看這裡的設定 -> 瞬間變成紅色 */
    transition: fill 0s;
}

/* 3. 電腦版 Hover */
/* (選用) 為了保持一致，Hover 也可以設為瞬間變紅 */
@media (hover: hover) {
    .sensor:not(.is-disabled):hover {
        fill: #ff0000;
        transition: fill 0s;
    }
}

/* --- 修改點 4: 新增禁用狀態樣式 --- */
/* 優先權要最高，覆蓋掉預設和啟動顏色 */
.sensor.is-disabled {
    fill: transparent; /* 或填入一個很淺的灰色 e.g., rgba(255,255,255,0.1) */
    stroke: #444444;   /* 灰色描邊 */
    stroke-width: 0px; /* 描邊寬度，依需求調整 */

    /* 關鍵指令：讓元素對滑鼠和觸控「隱形」 */
    /* 這會讓 JS 的 elementFromPoint 抓不到它，也不會觸發 hover 或 click */
    pointer-events: none;
}

/* 按鈕樣式 (保持不變) */
.button {
    position: fixed;
    top: 10px;
    padding: 10px 20px;
    background: #333;
    color: white;
    border: 1px solid #555;
    z-index: 100;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
}
.btn-mode { left: 10px; }
.btn-de { left: 150px; }
</style>