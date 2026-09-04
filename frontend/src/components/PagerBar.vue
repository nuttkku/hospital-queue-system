<template>
    <div class="pager">
        <button :disabled="page <= 1" @click="go(page - 1)">◀ ก่อนหน้า</button>
        <span class="pager-info">หน้า {{ page }} / {{ totalPages }} (รวม {{ total }} รายการ)</span>
        <button :disabled="page >= totalPages" @click="go(page + 1)">ถัดไป ▶</button>
    </div>
</template>

<script setup>
defineProps({
    total: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    totalPages: { type: Number, default: 1 },
});
const emit = defineEmits(["go"]);
function go(p) {
    if (p >= 1) emit("go", p);
}
</script>
