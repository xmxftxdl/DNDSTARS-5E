// Runs only in the module Worker. The package's JSON declares the spell and condition.
const extension = {
  setup(api) {
    if (api.sdkVersion !== 1) throw new Error('SDK 1 required');
    api.registerResource({ id: 'embers', label: '余烬', classId: 'wizard', maximum: 3, resetOn: 'long-rest' });
  }
};
export default extension;
