<script setup lang="ts">
import { reactive, onBeforeUnmount } from "vue";
import { sensors, type SensorKey } from "./sensorData.ts";

const props = defineProps<{
    activeIds: Set<SensorKey>;
    showDe: boolean;
}>();

const emit = defineEmits<{
    (e: "update:touched", ids: Set<SensorKey>): void;
    // 這裡改名，強調這是我們自己模擬的點擊，不是原生的
    (e: "sensor-tap", id: SensorKey): void;
}>();

const activePointers = reactive(new Map<number, SensorKey>());
const isDisabled = (id: SensorKey) => !props.showDe && /^[DE]/.test(id);

const emitTouchUpdate = () => {
    emit("update:touched", new Set(activePointers.values()));
};

// ==========================================
// 核心修改：Pointer Down (按下瞬間)
// ==========================================
const onPointerDown = (e: PointerEvent) => {
    // 1. 為了防止滑鼠右鍵等奇怪觸發
    if (e.pointerType === 'mouse' && e.buttons !== 1) return;

    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    const sensorId = target?.classList.contains("sensor") ? target.id as SensorKey : null;

    if (sensorId) {
        // A. 處理多點觸控邏輯 (原本的 Slide)
        activePointers.set(e.pointerId, sensorId);
        if (navigator.vibrate) navigator.vibrate(5);
        emitTouchUpdate();

        // B. 【新增】處理點擊邏輯 (Tap)
        // 我們在「按下去」的這一刻，直接視為「點擊」
        // 這比原生的 click 更快，而且完全受控
        emit("sensor-tap", sensorId);
    }

    // 捕捉 Pointer，確保手指滑出螢幕還能追蹤 (選用)
    (e.target as Element).setPointerCapture(e.pointerId);
};

const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) return;

    // 保持原本的滑動偵測邏輯
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    const sensorId = target?.classList.contains("sensor") ? target.id as SensorKey : null;

    if (sensorId) {
        const prevId = activePointers.get(e.pointerId);
        if (prevId !== sensorId) {
            activePointers.set(e.pointerId, sensorId);
            if (navigator.vibrate) navigator.vibrate(5);
        }
    } else {
        activePointers.delete(e.pointerId);
    }
    emitTouchUpdate();
};

const onPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    emitTouchUpdate();
    // 釋放捕捉
    if ((e.target as Element).hasPointerCapture(e.pointerId)) {
        (e.target as Element).releasePointerCapture(e.pointerId);
    }
};

onBeforeUnmount(() => activePointers.clear());
</script>

<template>
    <div
        class="ring-container"
        @touchstart.prevent
        @touchmove.prevent
        @touchend.prevent

        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @contextmenu.prevent
    >
        <svg viewBox="0 0 1440 1440">
            <path d="M0,0H1440V1440H0Z" fill="#000000" />
            <g>
                <path
                    v-for="s in sensors"
                    :key="s.id"
                    :id="s.id"
                    :d="s.d"
                    :transform="s.transform"
                    class="sensor"
                    :class="{
            active: props.activeIds.has(s.id),
            disabled: isDisabled(s.id),
          }"
                />
            </g>
        </svg>
    </div>
</template>
<style scoped>
.ring-container {
    /* 確保容器大小與比例 */
    height: 90dvmin;
    aspect-ratio: 1 / 1;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;

    /* 禁止預設觸控行為 (捲動、縮放、長按選取) */

}

svg {
    width: 100%;
    height: 100%;
    display: block;
    /* SVG 本身不擋滑鼠，讓事件穿透到 Path */
    pointer-events: none;
}

.sensor {
    fill: #000066; /* 預設深藍 */
    stroke: none;
    cursor: pointer;
    pointer-events: auto; /* Path 可互動 */

    /* 熄滅時：慢慢變回藍色 (Fade out) */
    transition: fill 0.00s linear;
}

/* 亮起狀態 (紅色) */
.sensor.active {
    fill: #ff0000;
    /* 亮起時：瞬間變色 (Instant) */
    transition: fill 0s;
}

/* 禁用狀態 (隱形/灰色) */
.sensor.disabled {
    fill: transparent; /* 或填 #111 看起來像熄滅 */
    stroke: #333; /* 加上框線示意位置 */
    stroke-width: 2px;

    /* 核心：讓元素對滑鼠/觸控隱形，JS 抓不到它 */
    pointer-events: none;
}

/* 電腦版 Hover 效果 (僅在非禁用且非亮起時) */
@media (hover: hover) {
    .sensor:not(.disabled):not(.active):hover {
        fill: #3333aa; /* 稍微變亮的藍色示意可點 */
        transition: fill 0.1s;
    }
}
</style>