# OTA (Over-The-Air) — atualizar sem baixar APK de novo

## O que você consegue mudar sem novo APK
- Telas, textos, cores, estilos, lógica JS/TS, chamadas de API
- Player, biblioteca, busca, fila, downloads

## O que EXIGE novo build (APK)
- Novo plugin nativo, permissão nova, `expo-XYZ` novo, mudança no `android/`

## Como funciona (já configurado no app)
- `runtimeVersion.fingerprint` + canal `production`
- `checkOnLaunch: "ON_LOAD"` → o app checa silenciosamente no boot
- Banner "Atualização disponível" + `Alert` "Atualização pronta"
- `eas.json` com `channel` + `autoIncrement: true`

## Publicar uma atualização JS-only
```bash
# na pasta apps/mobile
npm install
npx eas-cli@latest login   # 1x, na sua conta
npx eas-cli@latest init    # 1x, vincula o projeto

# depois, toda hora:
npm run update -- "v1.0.1: player novo"
# ou
npx eas update --branch production --message "v1.0.1: player novo"
```

## Novo build (quando mudar nativo)
```bash
npx eas build --profile production --platform android
# ou
npx eas build --profile preview --platform android   # teste interno
```

## Regra de ouro
- Mesmo `package` (`com.sultanxzk.ytmsc`) + mesmo keystore no EAS = instalação por cima sem desinstalar.
- OTA só entra se o `fingerprint` do binary for compatível.

## Fluxo do usuário
1. Abre o app → checa update em segundo plano
2. Se houver: banner "Atualização disponível"
3. Clica "Atualizar" → baixa o bundle `~2.6 MB` no fundo
4. Clica "OK" → reload. Sem reinstalar, sem baixar APK.
