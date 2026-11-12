# Como colocar o rastreio no repositório do GitHub

O arquivo `rastreio.patch` contém só as mudanças do rastreio em cima do último commit do repositório (1dab803, 03/11/2026).

```
git clone https://github.com/vitordapaixaodias567-lab/Bio_Oleo2.0
cd Bio_Oleo2.0
git checkout -b rastreio
git apply --check ../rastreio.patch     # só confere, não altera nada
git apply ../rastreio.patch
git status                              # confira: o arquivo .env NÃO pode aparecer
git add -A
git commit -m "Rastreio e monitoramento: mapa Google, rota, app do entregador"
git push -u origin rastreio
```
Depois, no GitHub, abra um **Pull Request** da branch `rastreio` para a `main` e peça para o grupo revisar. Se o repositório já tiver commits novos e o `git apply` reclamar, me avise com a mensagem.

Depois de aplicar: `cd BACKEND && npm install` (instala o `dotenv`) e `cd ../barbearia-react && npm install`.
