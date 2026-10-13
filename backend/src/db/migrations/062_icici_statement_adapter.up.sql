-- ICICI NetBanking statement PDFs are now read by the "icici" adapter.
UPDATE bank_presets SET adapter_id = 'icici', pdf_adapter_ready = TRUE WHERE id = 'ICICI';
