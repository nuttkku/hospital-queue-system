<template>
    <router-view v-if="auth.ready" />
</template>

<script setup>
import { auth } from "./store/auth";
</script>
