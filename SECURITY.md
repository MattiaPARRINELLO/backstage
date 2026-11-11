> **Document interne, ne pas publier.** Il décrit des vulnérabilités non
> corrigées. Ne pas committer sur une branche publiée ni joindre à une PR avant
> correction et vérification.

# Sécurité

Note d'audit du 10 novembre 2026, issue d'un scan [Strix](https://github.com/usestrix/strix)
lancé dans GitHub Actions sur la PR #37 (workflow `security.yml`, depuis fermée).

Modèle DeepSeek V4.1 Flash via OpenCode Go, mode `quick`, diff-scopé sur les
fichiers modifiés par la PR. Durée : environ 20 minutes. Résultat : aucune
vulnérabilité `high` ou `critical`, **2 findings `low`**, tous deux dans le
workflow de CI lui-même, pas dans l'application.

---

## 1. `GITHUB_TOKEN` avec `security-events: write` exposé au scanner

- **Sévérité** : basse, CVSS 2.2, CWE-522, confiance moyenne
- **Fichier** : `.github/workflows/security.yml`

Le workflow accordait `security-events: write` à l'ensemble du job et faisait le
checkout avec `persist-credentials: true` par défaut. Le `GITHUB_TOKEN` était donc
écrit dans `.git/config` du workspace, puis ce même workspace était remis à un
agent LLM tiers, sur un runner avec accès réseau. Le scanner disposait ainsi d'un
jeton capable de fermer des alertes Code Scanning et de supprimer des analyses,
soit plus de droits que nécessaire.

### Remédiation

- Passer `persist-credentials: false` au checkout.
- Réduire `permissions` au strict minimum et déplacer `security-events: write`
  sur un job d'upload séparé, sans accès au workspace modifié.

## 2. Base de diff résolue via un raccourci git ambigu

- **Sévérité** : basse, CVSS 2.2, CWE-706, confiance moyenne
- **Fichier** : `.github/workflows/security.yml`

Le diff-scope recevait `origin/$BASE_REF`. Un tag nommé `origin/<branche>` masque
la branche de suivi distante du même nom. Une personne capable de pousser un ref
pouvait donc pointer la base de diff sur le commit de tête de la PR : le scanner
calculait un ensemble de changements vide, le job passait au vert, et le gate
validait du code qu'il n'avait jamais analysé.

### Remédiation

- Utiliser la référence explicite `refs/remotes/origin/$BASE_REF`, ou
  `git rev-parse --verify` pour lever l'ambiguïté avant de lancer le scan.

---

## Statut

Les deux findings concernent un workflow abandonné : la PR #37 a été fermée sans
merge, et Strix n'est plus exécuté en CI sur ce dépôt.

## Couverture et limites

- Scan diff-scopé : seuls les fichiers de la PR ont été analysés, donc
  l'application elle-même n'a quasiment pas été testée.
- Aucun scan complet du code source n'a été réalisé à ce jour.
- Pour une vraie revue du projet :

```bash
strix -n -t ./ -m quick --fail-on high --max-budget 2 --max-turns 60
```
