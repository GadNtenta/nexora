CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'french_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french);
    ALTER TEXT SEARCH CONFIGURATION french_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, french_stem;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION document_content_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW."contentVector" :=
    setweight(to_tsvector('french_unaccent', coalesce(NEW.title, '')), 'A')
    || setweight(to_tsvector('french_unaccent', coalesce(NEW."extractedText", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE "Document"
SET "contentVector" =
  setweight(to_tsvector('french_unaccent', coalesce(title, '')), 'A')
  || setweight(to_tsvector('french_unaccent', coalesce("extractedText", '')), 'B');
