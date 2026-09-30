# Avaliação: registro de imagens sem autenticação

## Contexto

O reconhecimento de um pentest autorizado encontrou um subdomínio `registry.empresa.com` publicado. O escopo incluía a infraestrutura de CI/CD e o avaliador foi verificar se o registro de imagens exigia autenticação.

## Sintomas

```text
$ curl -s https://registry.empresa.com/v2/_catalog
{"repositories":["loja/api","loja/frontend","infra/backup","ci/deploy-tools"]}

$ curl -s https://registry.empresa.com/v2/loja/api/tags/list
{"name":"loja/api","tags":["1.0.0","1.4.2","2.3.1","latest"]}
```

O catálogo e as tags responderam **sem nenhuma credencial**.

<!-- solucao -->

## Investigação

O registro estava configurado sem autenticação para leitura (`pull`) e exposto na internet. Isso permite a um estranho:

- **Enumerar** todas as aplicações e versões (inteligência sobre a arquitetura).
- **Baixar** imagens e inspecioná-las por CVEs e por segredos embutidos em camadas.
- Descobrir versões antigas e vulneráveis ainda referenciadas.

O avaliador confirmou a exposição listando o catálogo (evidência mínima) e verificou, numa imagem, se havia segredos em camadas — registrando apenas a **existência** do problema, sem extrair conteúdo sensível.

## Causa raiz

Registro de imagens **sem autenticação e exposto publicamente**. Um registro é parte da cadeia de suprimentos: seu conteúdo revela a arquitetura e pode conter segredos.

## Correção

- Exigir autenticação para pull e push; expor o registro apenas na rede privada / via VPN.
- Escanear as imagens por segredos (Trivy `--scanners secret`) e **rotacionar** qualquer credencial encontrada embutida.
- Habilitar tags imutáveis e remover imagens antigas/vulneráveis.

## Prevenção

- Registro privado como única origem, com acesso de escrita só para o CI.
- Admission no cluster exigindo imagens do registro da empresa, assinadas e por digest.
- Scan contínuo do registro (novas CVEs surgem para imagens antigas).

Veja as políticas de imagem no simulador de supply chain (módulo de Hardening).
