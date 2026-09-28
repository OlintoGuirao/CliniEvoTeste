# Performance e memória: fluxo de câmera no Android

## 1. Diagnóstico técnico do problema

Quando o usuário abre a câmera no app (Capacitor/Android), o processo do app vai para **background**. A câmera do sistema consome muita RAM. Em dispositivos com pouca memória, o **Low Memory Killer (LMK)** do Android encerra processos em background para liberar RAM. Ao voltar da câmera, o usuário vê o app “reiniciando” porque o processo foi morto e o Android abriu um novo processo.

Isso tende a acontecer quando:
- Há várias fotos já carregadas na tela (decodificadas em memória).
- O usuário navega entre procedimentos (mais telas/estado em memória).
- Imagens grandes permanecem decodificadas (ex.: `<img src="url">` carrega a imagem em resolução cheia no WebView).
- **Câmera traseira:** o uso de memória da câmera traseira (preview + captura em alta resolução) é bem maior que o da frontal; em aparelhos com pouca RAM o reinício costuma ocorrer só ao usar a traseira, e não a frontal.

---

## 2. Pontos do código que geravam maior consumo de memória

| Ponto | Problema |
|-------|----------|
| **Preview das fotos** | `<img src={url}>` sem `loading="lazy"` nem `decoding="async"` carrega e decodifica todas as imagens da página de uma vez. |
| **Story Antes/Depois** | `loadImage(url)` usava `new Image()` e decodificava a imagem em **resolução total** antes de desenhar no canvas, gerando pico de RAM. |
| **Captura no Android** | Fotos em resolução alta (ex.: 1280px) + `fetch(webPath)` + `blob()` mantinham payload grande em memória ao voltar da câmera. |
| **Múltiplas fotos na tela** | Vários `PhotoUploadField` e listas de fotos em ProcedureInstanceDetailPage/ConsultationSessionPage decodificavam muitas imagens ao mesmo tempo. |
| **Estado da sessão** | Se o processo era morto ao abrir a câmera, o estado do formulário (fotos escolhidas, procedimentos) era perdido. |

---

## 3. Melhorias implementadas no código

### 3.1 PhotoUploadField (e câmera traseira)
- **Android – câmera traseira:** captura em **640px** e qualidade **70%** para reduzir ao máximo o uso de RAM (a traseira consome bem mais que a frontal).
- **Esconder todas as prévias antes de abrir a câmera:** ao tocar em “Tirar foto”, a página chama `onCameraOpen` (persiste rascunho e seta `cameraOpening=true`). Todas as prévias da tela passam a usar `previewVisible=false`, deixam de renderizar o `<img>` e liberam os bitmaps. Após **180ms** (tempo para o React re-renderizar), o app abre a câmera. Ao fechar a câmera, `onCameraClose` restaura as prévias. Assim a câmera traseira abre com o processo usando menos RAM.
- **Callback `onCameraOpen`:** persistir estado e esconder prévias; **`onCameraClose`:** restaurar prévias.
- **`previewVisible`:** quando `false` (card colapsado ou câmera aberta), não renderiza o `<img>` do preview.
- **Atraso 600ms** após voltar da câmera antes do `fetch`/upload para o WebView estabilizar (traseira usa muita RAM).

### 3.2 ConsultationSessionPage
- **Story Antes/Depois:** uso de `createImageBitmap(blob, { resizeWidth: 540, resizeHeight: 960 })` para decodificar a imagem já no tamanho necessário para o card, em vez de decodificar em resolução cheia. Após desenhar no canvas, `ImageBitmap.close()` libera o bitmap.
- **Persistência de rascunho:** antes de abrir a câmera, o estado relevante (procedimentos selecionados, fotos já escolhidas, dados genéricos) é salvo em `sessionStorage`. Se o app for morto e o usuário voltar à mesma consulta em até 30 min, o rascunho é restaurado automaticamente.
- **Imagens da sessão:** todas as `<img>` de fotos (Botox, emagrecimento, genéricas) com `decoding="async"` e `loading="lazy"`.

### 3.3 ProcedureInstanceDetailPage
- Todas as `<img>` que exibem `file_url` (antes/depois, grid de fotos) com `decoding="async"` e `loading="lazy"`.

### 3.4 AndroidManifest (já existente)
- `android:largeHeap="true"` para permitir heap maior antes de ser candidato ao LMK.
- `android:configChanges` e `launchMode="singleTask"` na `MainActivity` para reduzir recriação desnecessária da Activity.

---

## 4. Boas práticas para evitar LMK no fluxo de câmera

1. **Evitar manter imagens em resolução cheia na memória**  
   Preferir decodificar no tamanho de exibição (ex.: `createImageBitmap` com `resizeWidth`/`resizeHeight`) ou servir thumbnails quando houver muitos itens.

2. **Evitar base64 para imagens grandes**  
   Base64 aumenta o tamanho em ~33% e mantém a string na memória. Preferir `CameraResultType.Uri` e trabalhar com arquivo/Blob.

3. **Usar `loading="lazy"` e `decoding="async"` em listas/grids de fotos**  
   Reduz quantidade de imagens decodificadas ao mesmo tempo e evita picos de RAM.

4. **Persistir estado antes de abrir a câmera**  
   Salvar rascunho em `sessionStorage` (ou similar) e restaurar na volta; se o processo for morto, o usuário não perde o que preencheu.

5. **Limitar resolução da captura no Android**  
   Usar `width`/`height` e `quality` no plugin de câmera para já gravar em tamanho moderado (ex.: 960px) e reduzir o pico ao processar a foto.

6. **Liberar recursos explícitos**  
   Chamar `ImageBitmap.close()` após uso; evitar reter referências a Blobs/File após o upload.

---

## 5. Sugestões adicionais para resiliência

- **Activity separada para câmera:** o Capacitor já usa a câmera do sistema; abrir em Activity separada não é necessário e pode complicar. O que ajuda é reduzir memória do processo principal (como acima).

- **Lazy loading de imagens:** já adotado com `loading="lazy"`. Em listas muito longas, considerar virtualização (renderizar só as linhas visíveis) para reduzir número de nós DOM e de imagens carregadas.

- **Limpar cache ao navegar:** ao sair de uma tela pesada (ex.: detalhe do procedimento com muitas fotos), não é trivial “descarregar” imagens já decodificadas no WebView. O uso de `loading="lazy"` e menos imagens em resolução cheia já reduz a pressão.

- **Limitar imagens simultâneas:** em telas com muitos `PhotoUploadField` ou grids grandes, já limitamos o impacto com lazy loading; se necessário, pode-se limitar o número de previews em alta resolução (ex.: só as N primeiras em tamanho maior, demais em miniatura).

- **Monitorar memória (opcional):** em builds de debug, pode-se usar `performance.memory` (quando disponível no WebView) ou métricas nativas para acompanhar uso de RAM antes/depois da câmera e validar melhorias.

- **Câmera frontal vs traseira:** em dispositivos com pouca RAM, o reinício ao voltar da câmera costuma acontecer só com a **câmera traseira** (mais resolução = mais memória). Com a **frontal** o problema tende a não ocorrer. Se for aceitável para o fluxo, pode-se oferecer opção “Usar câmera frontal no Android” para priorizar estabilidade em vez de qualidade da foto.
