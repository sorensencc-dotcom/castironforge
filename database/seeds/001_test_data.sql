-- Test data for development and E2E testing

-- Insert test lead
INSERT INTO outreach_leads (email, name, company, title, industry)
VALUES (
  'john@example.com',
  'John Smith',
  'Acme Corp',
  'VP of Sales',
  'Technology'
) ON CONFLICT (email) DO NOTHING;

-- Insert test template
INSERT INTO outreach_templates (name, base_content, tone, personalization_tokens, created_by)
VALUES (
  'Test Template 1',
  'Hi {{lead.name}},\n\nI wanted to reach out to you at {{lead.company}}. We''ve been helping companies in the {{lead.industry}} industry improve their outreach processes.\n\nWould you be open to a quick chat?\n\nBest regards',
  'casual'::template_tone,
  ARRAY['{{lead.name}}', '{{lead.company}}', '{{lead.industry}}'],
  'system'
) ON CONFLICT DO NOTHING;

-- Insert another test template for A/B testing
INSERT INTO outreach_templates (name, base_content, tone, personalization_tokens, created_by)
VALUES (
  'Test Template 2',
  'Hello {{lead.name}},\n\nI hope this email finds you well. At {{lead.company}}, we''re always looking for innovative ways to streamline our processes. Have you considered using automated outreach tools?\n\nLet''s connect!\n\nRegards',
  'formal'::template_tone,
  ARRAY['{{lead.name}}', '{{lead.company}}'],
  'system'
) ON CONFLICT DO NOTHING;
