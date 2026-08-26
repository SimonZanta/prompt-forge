export interface PromptTemplate {
  name: string;
  content: string;
}

/** Starting points offered by the "+" menu in the sidebar. */
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { name: "Blank", content: "" },
  { name: "Tasks", content:
`<prompt>
  <context>context ...</context>
  <additional_context>additional context ...</additional_context>
  <tasks>
    <task>
      <task_description></task_description>
      <example></example>
    </task>
    <task>
      <task_description></task_description>
      <example></example>
    </task>
  </tasks>
</prompt>
` },
  { name: "Summarization", content:
`<prompt_summary>
  <instruction>
    Summarize the text provided in the \`<text_to_summarize>\` tag in a single concise paragraph.
    The answer should be placed within the \`<generated_summary>\` tag.
  </instruction>
  <text_to_summarize>

  </text_to_summarize>
  <expected_output_format>
    <generated_summary>[A concise paragraph here]</generated_summary>
  </expected_output_format>
</prompt_summary>
` },
  { name: "General", content:
`<prompt>
  <role>

  </role>
  <instruction>

  </instruction>
  <context>

  </context>
  <output_format>

  </output_format>
</prompt>
` },
];

/** Shown in the highlight layer while the editor is empty. */
export const EDITOR_PLACEHOLDER =
`Write your prompt…

<          tag suggestions, tags auto-close
</         completes the open tag
select     then " ' ( [ { \` * _ to wrap it, Tab to indent
Ctrl+B/I/E **bold** *italic* \`code\`
\`\`\`lang    fenced code blocks`;
