/** Content of the example prompt inserted into an empty database. */
export const EXAMPLE_PROMPT_TITLE = "Summary prompt (example)";

export const EXAMPLE_PROMPT_CONTENT = `<prompt_summary>
  <instruction>
    Summarize the text provided in the \`<text_to_summarize>\` tag in a single concise paragraph,
    focusing on the main challenges and solutions presented. The answer should be placed
    within the \`<generated_summary>\` tag.
  </instruction>
  <text_to_summarize>
    The rapid expansion of generative artificial intelligence presents a unique set of ethical challenges,
    including the potential for misinformation, the perpetuation of biases present in training data,
    and issues related to intellectual property.
  </text_to_summarize>
  <expected_output_format>
    <generated_summary>[A concise paragraph here]</generated_summary>
  </expected_output_format>
</prompt_summary>
`;
