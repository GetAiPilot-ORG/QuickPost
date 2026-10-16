-- Migration: Add system_prompt and custom prompt configuration to instagram_bots
alter table instagram_bots
  add column if not exists system_prompt text;

comment on column instagram_bots.system_prompt is 'Custom dynamic AI system instructions and behavioral persona rules.';
