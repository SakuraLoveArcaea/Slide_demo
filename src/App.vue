<script setup lang="ts">
import MaimaiSensor from "./maimaiSensor/MaimaiSensor.vue";
</script>

<template>
  <MaimaiSensor></MaimaiSensor>
</template>

<style>
body {
    /* 背景黑色 */
    background-color: #000000;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100dvh;
    margin: 0;
    overflow: hidden; /* 防止滾動條出現 */
}
</style>
