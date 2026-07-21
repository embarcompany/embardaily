-- Modelos são dados, não código: podem ser ajustados pelo time depois.
-- O Toque 1 é disparado automaticamente pela Edge Function; os seguintes são sugestões manuais.
create table if not exists public.message_templates (
  code text primary key,
  name text not null,
  body text not null,
  automatic boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true
);

alter table public.message_templates enable row level security;
create policy "staff manages message templates" on public.message_templates for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.message_templates (code, name, body, automatic, sort_order) values
('toque_1', 'Toque 1 — acolhimento', 'Oi, {{primeiro_nome}}! Tudo bem? Aqui é da Embarpet. Como foi a chegada e adaptação por aí? 💛', true, 1),
('avaliacao_google', 'Avaliação no Google', 'Ficamos muito felizes em acompanhar vocês. Se fizer sentido, sua avaliação ajuda outras famílias: {{link_google}}', false, 2),
('autorizacao_instagram', 'Autorização para Instagram', 'Podemos compartilhar um pedacinho dessa história no nosso Instagram? Só publicamos com sua autorização. 💛', false, 3),
('lembrete_leve', 'Lembrete leve', 'Passando só para deixar nosso carinho. Quando puder, conte para a gente como vocês estão por aí. 💛', false, 4)
on conflict (code) do update set name = excluded.name, body = excluded.body, automatic = excluded.automatic, sort_order = excluded.sort_order;
