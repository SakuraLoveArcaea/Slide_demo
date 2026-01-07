<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { type SensorKey } from "./sensorData.ts";
import SensorRing from "./SensorRing.vue";

// --- 狀態 ---
const isLockMode = ref(false); // Toggle 模式開關
const isDeEnabled = ref(true); // D/E 區開關

// 來自 SensorRing 的即時觸控資料 (Set)
const touchedIds = ref(new Set<SensorKey>());

// 儲存 Toggle 模式下被鎖定長亮的 ID (Set)
const lockedIds = reactive(new Set<SensorKey>());

// --- 核心邏輯：計算最終誰該亮 ---
const finalActiveIds = computed(() => {
    if (isLockMode.value) {
        // 鎖定模式：只顯示被鎖定的
        return lockedIds;
    } else {
        // 一般模式：顯示手按住的
        return touchedIds.value;
    }
});

// --- 事件處理 ---

// 1. 當 SensorRing 回報觸控狀態改變
const handleTouchUpdate = (ids: Set<SensorKey>) => {
    if (!isLockMode.value) {
        touchedIds.value = ids;
    }
};

// 2. 當 SensorRing 回報被點擊 (處理 Toggle 邏輯)
const handleSensorClick = (id: SensorKey) => {
    if (isLockMode.value) {
        if (lockedIds.has(id)) lockedIds.delete(id);
        else lockedIds.add(id);
    }
};

// 3. 切換 D/E 啟用狀態
const toggleDe = () => {
    isDeEnabled.value = !isDeEnabled.value;
    if (!isDeEnabled.value) {
        // 關閉時，清除殘留在 D/E 的鎖定狀態
        [...lockedIds].forEach(id => /^[DE]/.test(id) && lockedIds.delete(id));
    }
};
</script>

<template>
    <div class="app-container">
        <div class="controls">
            <button @click="isLockMode = !isLockMode">
                {{ isLockMode ? 'Mode: Lock' : 'Mode: Touch' }}
            </button>
            <button @click="toggleDe">
                {{ isDeEnabled ? 'D/E: On' : 'D/E: Off' }}
            </button>
        </div>

        <SensorRing
            :active-ids="finalActiveIds"
            :show-de="isDeEnabled"
            @update:touched="handleTouchUpdate"
            @sensor-tap="handleSensorClick"
        />
    </div>
</template>

<style scoped>
.app-container {
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
</style>