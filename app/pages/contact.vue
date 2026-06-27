<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';
import Logo from '../components/ds/Logo.vue';
import IconButton from '../components/ds/IconButton.vue';
import Button from '../components/ds/Button.vue';

import { segActive, segBaseMd as segBase, segIdle } from '../components/ds/segmented';

useSeoMeta({
    title: 'Contact - PhaseScope',
    description:
        'Get in touch about PhaseScope, the real-time 3D audio visualiser - share feedback, ideas, code or a demo track, or open an issue and contribute on GitHub.',
});

const router = useRouter();
const close = () => router.push('/');

const WEB3FORMS_ACCESS_KEY = '4e319bb2-3e70-477b-bb42-ff93ec2b0ce2';

const schema = z.object({
    email: z.email('Enter a valid email address'),
    message: z.string().trim().min(1, 'Please write a message').max(5000, 'That message is a little too long'),
});
type Schema = z.output<typeof schema>;

const state = reactive<{ email: string; message: string }>({
    email: '',
    message: '',
});

const sending = ref(false);
const { show } = usePsToast();

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
    sending.value = true;
    try {
        const body = new FormData();
        body.append('access_key', WEB3FORMS_ACCESS_KEY);
        body.append('subject', 'New message from PhaseScope');
        body.append('from_name', 'PhaseScope contact form');
        body.append('email', event.data.email);
        body.append('message', event.data.message);

        const res = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body,
        });
        const data = await res.json();
        if (res.ok && data.success) {
            show('success', 'Message sent', 'Thanks - I will get back to you.');
            state.email = '';
            state.message = '';
        } else {
            show('error', 'Could not send', data.message ?? 'Please try again in a moment.');
        }
    } catch {
        show('error', 'Something went wrong', 'Please check your connection and try again.');
    } finally {
        sending.value = false;
    }
};

// Field skin - chamfered, surface fill, brand focus glow: mirrors the
// transport dock's select menu (the app's other Nuxt UI input control).
const fieldUi = {
    base: 'rounded-none bg-(--surface) text-(--text) ring-(--border-strong) [clip-path:var(--clip-chamfer-sm)] placeholder:text-(--text-muted) focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-(--focus-glow)',
};
const formFieldUi = {
    label: 'font-mono uppercase tracking-label text-caption text-(--text-muted)',
    error: 'text-detail text-(--error)',
};
</script>

<template>
    <main class="min-h-svh bg-(--bg) px-6 py-14 text-(--text) md:py-20">
        <div class="mx-auto flex w-full max-w-[31em] flex-col gap-12">
            <div class="flex items-center justify-between gap-4">
                <NuxtLink
                    to="/"
                    class="inline-flex w-fit items-center gap-3 text-(--text) no-underline hover:no-underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                    aria-label="Back to the visualiser"
                >
                    <Logo :size="34" class="shrink-0" />
                    <span class="font-display text-title font-semibold leading-none tracking-display">
                        Phase<span class="text-(--accent)">Scope</span>
                    </span>
                </NuxtLink>
                <IconButton
                    icon="i-lucide-x"
                    variant="ghost"
                    aria-label="Close and return to the visualiser"
                    @click="close"
                />
            </div>

            <nav aria-label="Page section" class="flex flex-wrap gap-1.5">
                <NuxtLink :to="'/about'" :class="[segBase, segIdle]">About</NuxtLink>
                <NuxtLink :to="'/influences'" :class="[segBase, segIdle]">Influences</NuxtLink>
                <span :class="[segBase, segActive]" aria-current="page">Contact</span>
            </nav>

            <section class="flex flex-col gap-7">
                <h1 class="font-display text-display font-semibold tracking-display">Contact</h1>
                <p class="text-body leading-(--line-height-normal) text-(--text-muted)">
                    Want to contribute ideas or a demo tracks? Have some feedback or a painted composition to share? Use
                    the form below to get in touch - I'd love to hear from you!
                </p>

                <UForm :schema="schema" :state="state" class="flex flex-col gap-6" @submit="onSubmit">
                    <UFormField label="Email" name="email" :ui="formFieldUi">
                        <UInput
                            v-model="state.email"
                            type="email"
                            autocomplete="email"
                            placeholder="you@example.com"
                            size="lg"
                            class="w-full"
                            :ui="fieldUi"
                        />
                    </UFormField>

                    <UFormField label="Message" name="message" :ui="formFieldUi">
                        <UTextarea
                            v-model="state.message"
                            :rows="6"
                            placeholder="Please enter your message"
                            size="lg"
                            class="w-full"
                            :ui="fieldUi"
                        />
                    </UFormField>

                    <Button
                        type="submit"
                        size="lg"
                        class="w-fit"
                        :loading="sending"
                        :disabled="sending"
                        :label="sending ? 'Sending...' : 'Send message'"
                    />
                </UForm>
            </section>

            <USeparator />

            <section class="flex flex-col gap-4" aria-labelledby="contribute-heading">
                <div
                    class="inline-flex w-fit items-center gap-2 font-display text-detail font-semibold text-(--accent) no-underline hover:underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                >
                    <UIcon name="i-lucide-github" class="size-8 shrink-0" aria-hidden="true" />
                    <h2 id="contribute-heading" class="font-display font-semibold tracking-display text-display">
                        Contribute
                    </h2>
                </div>
                <p class="text-body leading-(--line-height-normal) text-(--text-muted)">
                    PhaseScope is free and open source. Found a bug, have a feature in mind, or want to add a new
                    topology or a demo track? Open an issue or send a pull request - contributions of every kind are
                    welcome, and a star never goes unnoticed.
                </p>
                <a
                    href="https://github.com/loopwrk/PhaseScope"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex w-fit items-center gap-2 font-display text-detail font-semibold text-(--accent) no-underline hover:underline focus-visible:shadow-(--focus-glow) focus-visible:outline-none"
                >
                    View the repository on GitHub
                    <span aria-hidden="true">&#8599;</span>
                    <span class="sr-only">(opens in a new tab)</span>
                </a>
            </section>
        </div>
    </main>
</template>
