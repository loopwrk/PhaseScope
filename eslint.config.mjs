// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
    { ignores: ['.venv-gw/**', '.data/**'] },
    {
        rules: {
            'vue/require-default-prop': 'off',
            'vue/html-self-closing': ['warn', { html: { void: 'always', normal: 'always', component: 'always' } }],
            // ref-through-prop writes (ScopeSettingsModel) mutate contents, not the prop
            'vue/no-mutating-props': ['error', { shallowOnly: true }],
        },
    }
);
