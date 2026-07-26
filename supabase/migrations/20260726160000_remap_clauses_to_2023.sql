-- Remap standards_reference + findings from ICTA.6.002:2019 §6.4 → ICTA.6.003:2023 §6.5
-- Domain rules split: TLD→6.5.6, semantic→6.5.7, format/duplicate/etc→6.5.8
-- Other clauses: flat +3 on the second number (6.4.N → 6.5.(N+3)), including .i–.iv suffixes.

-- Domain special cases (by check_name)
UPDATE standards_reference SET clause_number = '6.5.6' WHERE check_name = 'domain_tld' AND clause_number LIKE '6.4.%';
UPDATE standards_reference SET clause_number = '6.5.7' WHERE check_name = 'domain_semantic_relevance' AND clause_number LIKE '6.4.%';
UPDATE standards_reference SET clause_number = '6.5.8'
WHERE check_name IN (
  'domain_length',
  'domain_not_numeric',
  'domain_not_duplicate',
  'domain_not_personal_name',
  'domain_format'
) AND clause_number LIKE '6.4.%';

UPDATE findings SET clause_reference = '6.5.6' WHERE check_name = 'domain_tld' AND clause_reference LIKE '6.4.%';
UPDATE findings SET clause_reference = '6.5.7' WHERE check_name = 'domain_semantic_relevance' AND clause_reference LIKE '6.4.%';
UPDATE findings SET clause_reference = '6.5.8'
WHERE check_name IN (
  'domain_length',
  'domain_not_numeric',
  'domain_not_duplicate',
  'domain_not_personal_name',
  'domain_format'
) AND clause_reference LIKE '6.4.%';

-- Flat +3 remap for remaining 6.4.* rows (N >= 6)
UPDATE standards_reference
SET clause_number =
  '6.5.'
  || ((substring(clause_number FROM '^6\.4\.(\d+)'))::integer + 3)::text
  || coalesce(substring(clause_number FROM '^6\.4\.\d+(\..+)$'), '')
WHERE clause_number ~ '^6\.4\.([6-9]|1[0-9]|2[0-3])(\.|$)';

UPDATE findings
SET clause_reference =
  '6.5.'
  || ((substring(clause_reference FROM '^6\.4\.(\d+)'))::integer + 3)::text
  || coalesce(substring(clause_reference FROM '^6\.4\.\d+(\..+)$'), '')
WHERE clause_reference ~ '^6\.4\.([6-9]|1[0-9]|2[0-3])(\.|$)';
