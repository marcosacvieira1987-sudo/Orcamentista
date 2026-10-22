# Emails de autenticação em português

Supabase → **Authentication → Emails → Templates**. Em cada modelo, substitua o **Subject** e o **Message body** pelos textos abaixo e clique em **Save**. Não altere o que está entre `{{ }}`.

---

## Confirm signup (confirmar registo)

**Subject:** Confirme o seu email — Prumo Orçamentista

```html
<h2>Bem-vindo ao Prumo Orçamentista</h2>
<p>Obrigado pelo registo. Para ativar a sua conta, confirme o seu email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar email</a></p>
<p>Se não criou esta conta, pode ignorar este email.</p>
```

## Reset password (recuperar palavra-passe)

**Subject:** Definir nova palavra-passe — Prumo Orçamentista

```html
<h2>Nova palavra-passe</h2>
<p>Recebemos um pedido para definir uma nova palavra-passe na sua conta.</p>
<p><a href="{{ .ConfirmationURL }}">Definir nova palavra-passe</a></p>
<p>Se não foi você, ignore este email: a palavra-passe atual mantém-se.</p>
```

## Change email address (mudar email)

**Subject:** Confirme o novo email — Prumo Orçamentista

```html
<h2>Confirmar alteração de email</h2>
<p>Para passar a usar <strong>{{ .NewEmail }}</strong> na sua conta, confirme aqui:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar novo email</a></p>
```

## Magic link (entrada sem palavra-passe)

**Subject:** O seu link de entrada — Prumo Orçamentista

```html
<h2>Entrar no Prumo Orçamentista</h2>
<p><a href="{{ .ConfirmationURL }}">Entrar</a></p>
<p>Se não pediu este link, ignore este email.</p>
```

---

**Antes de abrir a outros profissionais:** configure SMTP próprio em *Authentication → Emails → SMTP Settings* (ex.: Brevo, Resend ou o email da empresa). O envio incluído no Supabase tem um limite baixo de emails por hora.
