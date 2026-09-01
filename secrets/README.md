# Cofre de credenciais (local)

| Ficheiro | Conteúdo |
|----------|----------|
| **`CREDENCIAIS-PRODUCAO.env`** | Env completo de produção (OpenRouter, proxy, Stripe, DB, …) |
| **`proxy_list.txt`** | Linha do proxy Proxy-Cheap (cópia do teu `Downloads/proxy_list.txt`) |

O ficheiro principal **`CREDENCIAIS-PRODUCAO.env`** contém chaves de produção (OpenRouter, proxy SPY, Stripe, etc.).

- Está no **`.gitignore`** — não vai para o Git.
- Cópia de referência na VPS: `/var/www/ecom-taskforce/env-config`
- O script `scripts/deploy-contabo.sh` **não** sobrescreve `env-config` no rsync.

Após editar credenciais aqui, sincronizar na VPS:

```bash
scp -i ~/.ssh/contabo-taskforce/id_ed25519 secrets/CREDENCIAIS-PRODUCAO.env root@173.249.32.180:/var/www/ecom-taskforce/env-config
ssh root@173.249.32.180 'cp /var/www/ecom-taskforce/env-config /var/www/ecom-taskforce/.env && cp /var/www/ecom-taskforce/env-config /var/www/ecom-taskforce/apps/web/.env.local && pm2 restart ecom-api'
```
