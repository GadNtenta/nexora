-- Index title + body in FTS, with title weighted higher.
CREATE OR REPLACE FUNCTION document_content_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW."contentVector" :=
    setweight(to_tsvector('french', coalesce(NEW.title, '')), 'A')
    || setweight(to_tsvector('french', coalesce(NEW."extractedText", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_content_vector_trigger ON "Document";

CREATE TRIGGER document_content_vector_trigger
  BEFORE INSERT OR UPDATE OF title, "extractedText"
  ON "Document"
  FOR EACH ROW
  EXECUTE FUNCTION document_content_vector_update();

UPDATE "Document"
SET "contentVector" =
  setweight(to_tsvector('french', coalesce(title, '')), 'A')
  || setweight(to_tsvector('french', coalesce("extractedText", '')), 'B');
