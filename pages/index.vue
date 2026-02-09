<template>
  <AppDesignV2 />
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api';
import AppDesignV2 from '~/components/AppDesignV2.vue';

export default defineComponent({
  name: 'IndexPage',
  components: {
    AppDesignV2,
  },
});
</script>
