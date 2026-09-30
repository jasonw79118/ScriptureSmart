import { Account, Client, Functions, ID } from 'appwrite';
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT?.trim();
const project = import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim();
export const client =
  endpoint && project
    ? new Client().setEndpoint(endpoint).setProject(project)
    : null;
export const account = client ? new Account(client) : null;
const functions = client ? new Functions(client) : null;
export const functionId =
  import.meta.env.VITE_APPWRITE_COMMUNITY_FUNCTION_ID?.trim();
export async function communityRequest(
  action: string,
  args: Record<string, unknown> = {},
) {
  if (!functions || !functionId)
    throw Error(
      'Shared groups are not connected yet. Deploy the Appwrite community function and add its ID to configuration.',
    );
  const execution = await functions.createExecution({
    functionId,
    body: JSON.stringify({ action, ...args }),
    async: false,
  });
  let result;
  try {
    result = JSON.parse(execution.responseBody);
  } catch {
    throw Error(
      'The community service did not return a response. Check its deployment and execution permissions.',
    );
  }
  if (execution.responseStatusCode >= 400 || result.error)
    throw Error(result.error || 'Community request failed.');
  return result;
}
export { ID };
