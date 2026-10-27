// AVA knowledge files and the Playground test sheet, generated at build. See src/lib/ava-knowledge.ts.
import type { APIRoute, GetStaticPaths } from 'astro';
import { knowledgeFiles, testQuestionsCsv } from '../../lib/ava-knowledge';

export const getStaticPaths = (() => [
  ...knowledgeFiles(import.meta.env.SITE).map((f) => ({ params: { path: f.path }, props: { body: f.body, type: 'text/plain; charset=utf-8' } })),
  { params: { path: 'ava-test-questions.csv' }, props: { body: testQuestionsCsv(), type: 'text/csv; charset=utf-8' } },
]) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response((props as { body: string }).body, { headers: { 'Content-Type': (props as { type: string }).type } });
