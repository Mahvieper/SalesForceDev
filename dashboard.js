let salesforceAPI = null;
let allRecords = [];
let allFields = [];
let currentPage = 1;
let pageSize = 50;
let totalRecords = 0;
let currentFilters = {};
let searchTerm = '';

const RECORDS_PER_PAGE = 50;

const ACTION_MAP = {
    suOrgAdminLogin: { text: 'Logged in as another user', severity: 'critical', category: 'login', type: 'login' },
    suOrgAdminLogout: { text: 'Logged out from another user session', severity: 'critical', category: 'login', type: 'login' },
    suloginaccessused: { text: 'Used Login-As access to impersonate user', severity: 'critical', category: 'login', type: 'login' },
    suNetworkAdminLogin: { text: 'Logged in as user via Customer Portal', severity: 'critical', category: 'login', type: 'login' },
    suNetworkAdminLogout: { text: 'Logged out from portal user session', severity: 'critical', category: 'login', type: 'login' },
    suPRMAdminLogin: { text: 'Logged in as partner user', severity: 'critical', category: 'login', type: 'login' },
    suPRMAdminLogout: { text: 'Logged out from partner user session', severity: 'critical', category: 'login', type: 'login' },
    loginasgrantedtosfdc: { text: 'Granted login access to Salesforce Support', severity: 'warning', category: 'security', type: 'modify' },
    loginasrevokedtosfdc: { text: 'Revoked login access from Salesforce Support', severity: 'info', category: 'security', type: 'modify' },
    PermSetAssign: { text: 'Assigned permission set to user', severity: 'critical', category: 'permission', type: 'assign' },
    PermSetUnassign: { text: 'Unassigned permission set from user', severity: 'warning', category: 'permission', type: 'assign' },
    PermSetCreate: { text: 'Created permission set', severity: 'warning', category: 'permission', type: 'create' },
    PermSetDelete: { text: 'Deleted permission set', severity: 'warning', category: 'permission', type: 'delete' },
    PermSetCloneNoLicense: { text: 'Cloned permission set', severity: 'warning', category: 'permission', type: 'create' },
    PermSetLabelChange: { text: 'Changed permission set label', severity: 'info', category: 'permission', type: 'modify' },
    PermSetDescriptionChange: { text: 'Changed permission set description', severity: 'info', category: 'permission', type: 'modify' },
    PermSetDeveloperNameChange: { text: 'Changed permission set API name', severity: 'info', category: 'permission', type: 'modify' },
    PermSetEntityPermChanged: { text: 'Changed object permissions on permission set', severity: 'critical', category: 'permission', type: 'modify' },
    PermSetEnableUserPerm: { text: 'Enabled user permission on permission set', severity: 'critical', category: 'permission', type: 'modify' },
    PermSetDisableUserPerm: { text: 'Disabled user permission on permission set', severity: 'critical', category: 'permission', type: 'modify' },
    PermSetFlsChanged: { text: 'Changed field-level security on permission set', severity: 'warning', category: 'permission', type: 'modify' },
    PermSetGroupAssign: { text: 'Assigned permission set group to user', severity: 'critical', category: 'permission', type: 'assign' },
    PermSetGroupUnassign: { text: 'Unassigned permission set group from user', severity: 'warning', category: 'permission', type: 'assign' },
    PermissionSetGroupCreate: { text: 'Created permission set group', severity: 'warning', category: 'permission', type: 'create' },
    PermissionSetGroupDelete: { text: 'Deleted permission set group', severity: 'warning', category: 'permission', type: 'delete' },
    PermissionSetGroupComponentAdd: { text: 'Added component to permission set group', severity: 'warning', category: 'permission', type: 'modify' },
    PermissionSetGroupComponentRemove: { text: 'Removed component from permission set group', severity: 'warning', category: 'permission', type: 'modify' },
    PermSetLicenseAssign: { text: 'Assigned permission set license to user', severity: 'warning', category: 'permission', type: 'assign' },
    PermSetLicenseUnassign: { text: 'Unassigned permission set license from user', severity: 'warning', category: 'permission', type: 'assign' },
    changedprofileforuser: { text: 'Changed profile for user', severity: 'critical', category: 'permission', type: 'modify' },
    changedprofileforusercusttostd: { text: 'Changed user profile from custom to standard', severity: 'critical', category: 'permission', type: 'modify' },
    profilePermChangedCustom: { text: 'Changed permissions on custom profile', severity: 'critical', category: 'permission', type: 'modify' },
    profileOlpChangedCustom: { text: 'Changed object permissions on profile', severity: 'critical', category: 'permission', type: 'modify' },
    profileFlsChangedCustom: { text: 'Changed field-level security on profile', severity: 'warning', category: 'permission', type: 'modify' },
    profileFlsChangedStandard: { text: 'Changed field-level security on standard profile', severity: 'warning', category: 'permission', type: 'modify' },
    profileClonedCustom: { text: 'Cloned custom profile', severity: 'warning', category: 'permission', type: 'create' },
    profileClonedStandard: { text: 'Cloned standard profile', severity: 'warning', category: 'permission', type: 'create' },
    deletedprofile: { text: 'Deleted profile', severity: 'critical', category: 'permission', type: 'delete' },
    profileDescriptionChanged: { text: 'Changed profile description', severity: 'info', category: 'permission', type: 'modify' },
    profileRecordTypeAddedCustom: { text: 'Added record type access to profile', severity: 'warning', category: 'permission', type: 'modify' },
    profileRecordTypeRemovedCustom: { text: 'Removed record type access from profile', severity: 'warning', category: 'permission', type: 'modify' },
    createduser: { text: 'Created user', severity: 'warning', category: 'user', type: 'create' },
    deactivateduser: { text: 'Deactivated user', severity: 'critical', category: 'user', type: 'modify' },
    activateduser: { text: 'Activated user', severity: 'warning', category: 'user', type: 'modify' },
    frozeuser: { text: 'Froze user account', severity: 'warning', category: 'user', type: 'modify' },
    unfrozeuser: { text: 'Unfroze user account', severity: 'info', category: 'user', type: 'modify' },
    unlockeduser: { text: 'Unlocked user after lockout', severity: 'info', category: 'user', type: 'modify' },
    changedpassword: { text: 'Changed password', severity: 'warning', category: 'user', type: 'modify' },
    resetpassword: { text: 'Reset password for user', severity: 'warning', category: 'user', type: 'modify' },
    changedusername: { text: 'Changed username', severity: 'warning', category: 'user', type: 'modify' },
    changedemail: { text: 'Changed email address', severity: 'warning', category: 'user', type: 'modify' },
    changedroleforuser: { text: 'Changed role for user', severity: 'warning', category: 'user', type: 'modify' },
    changedroleforuserfromnone: { text: 'Assigned role to user', severity: 'warning', category: 'user', type: 'modify' },
    changedroleforusertonone: { text: 'Removed role from user', severity: 'warning', category: 'user', type: 'modify' },
    changedManager: { text: 'Changed manager for user', severity: 'info', category: 'user', type: 'modify' },
    changedfederationid: { text: 'Changed Federation ID for user', severity: 'warning', category: 'user', type: 'modify' },
    createdCustEnt: { text: 'Created custom object', severity: 'warning', category: 'metadata', type: 'create' },
    deletedCustEnt: { text: 'Deleted custom object', severity: 'warning', category: 'metadata', type: 'delete' },
    changedCustEntLabel: { text: 'Changed custom object label', severity: 'info', category: 'metadata', type: 'modify' },
    changedCustEntName: { text: 'Changed custom object API name', severity: 'warning', category: 'metadata', type: 'modify' },
    createdCF: { text: 'Created custom field', severity: 'info', category: 'metadata', type: 'create' },
    deletedCF: { text: 'Deleted custom field', severity: 'warning', category: 'metadata', type: 'delete' },
    changedCF: { text: 'Changed custom field', severity: 'info', category: 'metadata', type: 'modify' },
    changedCFType: { text: 'Changed field data type', severity: 'warning', category: 'metadata', type: 'modify' },
    changedCFLength: { text: 'Changed field length', severity: 'info', category: 'metadata', type: 'modify' },
    changedCFFormula: { text: 'Changed formula field definition', severity: 'info', category: 'metadata', type: 'modify' },
    changedCFDefault: { text: 'Changed default value for field', severity: 'info', category: 'metadata', type: 'modify' },
    changedCFOptionOffOn: { text: 'Made field required', severity: 'warning', category: 'metadata', type: 'modify' },
    changedCFOptionOnOff: { text: 'Made field optional', severity: 'info', category: 'metadata', type: 'modify' },
    changedPicklist: { text: 'Changed picklist values', severity: 'info', category: 'metadata', type: 'modify' },
    changedPicklistDefault: { text: 'Changed picklist default value', severity: 'info', category: 'metadata', type: 'modify' },
    changedPicklistReplace: { text: 'Replaced picklist value', severity: 'info', category: 'metadata', type: 'modify' },
    createdApexClass: { text: 'Created Apex class', severity: 'warning', category: 'metadata', type: 'create' },
    deletedApexClass: { text: 'Deleted Apex class', severity: 'warning', category: 'metadata', type: 'delete' },
    changedApexClass: { text: 'Changed Apex class code', severity: 'warning', category: 'metadata', type: 'modify' },
    createdApexTrigger: { text: 'Created Apex trigger', severity: 'warning', category: 'metadata', type: 'create' },
    deletedApexTrigger: { text: 'Deleted Apex trigger', severity: 'warning', category: 'metadata', type: 'delete' },
    changedApexTrigger: { text: 'Changed Apex trigger code', severity: 'warning', category: 'metadata', type: 'modify' },
    createdApexPage: { text: 'Created Visualforce page', severity: 'info', category: 'metadata', type: 'create' },
    deletedApexPage: { text: 'Deleted Visualforce page', severity: 'info', category: 'metadata', type: 'delete' },
    changedApexPage: { text: 'Changed Visualforce page', severity: 'info', category: 'metadata', type: 'modify' },
    createdinteractiondefinition: { text: 'Created Flow', severity: 'warning', category: 'automation', type: 'create' },
    deletedinteractiondefinition: { text: 'Deleted Flow', severity: 'warning', category: 'automation', type: 'delete' },
    activatedinteractiondefinition: { text: 'Activated Flow', severity: 'warning', category: 'automation', type: 'modify' },
    deactivatedinteractiondefinition: { text: 'Deactivated Flow', severity: 'warning', category: 'automation', type: 'modify' },
    activatedinteractiondefinitionWithSystemMode: { text: 'Activated Flow in System Mode', severity: 'critical', category: 'automation', type: 'modify' },
    createdworkflowrule: { text: 'Created workflow rule', severity: 'info', category: 'automation', type: 'create' },
    deletedworkflowrule: { text: 'Deleted workflow rule', severity: 'info', category: 'automation', type: 'delete' },
    activatedworkflowrule: { text: 'Activated workflow rule', severity: 'info', category: 'automation', type: 'modify' },
    deactivatedworkflowrule: { text: 'Deactivated workflow rule', severity: 'info', category: 'automation', type: 'modify' },
    createdprocessdefinition: { text: 'Created approval process', severity: 'warning', category: 'automation', type: 'create' },
    deletedprocessdefinition: { text: 'Deleted approval process', severity: 'warning', category: 'automation', type: 'delete' },
    activatedprocessdefinition: { text: 'Activated approval process', severity: 'warning', category: 'automation', type: 'modify' },
    deactivatedprocessdefinition: { text: 'Deactivated approval process', severity: 'warning', category: 'automation', type: 'modify' },
    newValidation: { text: 'Created validation rule', severity: 'warning', category: 'metadata', type: 'create' },
    removedValidation: { text: 'Removed validation rule', severity: 'warning', category: 'metadata', type: 'delete' },
    changedValidationFormula: { text: 'Changed validation rule formula', severity: 'warning', category: 'metadata', type: 'modify' },
    changedValidationActive: { text: 'Activated/deactivated validation rule', severity: 'warning', category: 'metadata', type: 'modify' },
    insertApplication: { text: 'Created connected app', severity: 'warning', category: 'security', type: 'create' },
    deleteApplication: { text: 'Deleted connected app', severity: 'warning', category: 'security', type: 'delete' },
    blockConnectedApplication: { text: 'Blocked connected app', severity: 'warning', category: 'security', type: 'modify' },
    unblockConnectedApplication: { text: 'Unblocked connected app', severity: 'critical', category: 'security', type: 'modify' },
    changeApplicationCertificate: { text: 'Changed connected app certificate', severity: 'critical', category: 'security', type: 'modify' },
    changeApplicationPkceRequired: { text: 'Changed PKCE requirement for connected app', severity: 'critical', category: 'security', type: 'modify' },
    changeApplicationRefreshTokenRotationEnabled: { text: 'Changed refresh token rotation for connected app', severity: 'critical', category: 'security', type: 'modify' },
    changeIpRelaxationPolicy: { text: 'Changed IP relaxation policy for connected app', severity: 'critical', category: 'security', type: 'modify' },
    changeOauthDefaultScope: { text: 'Changed OAuth scopes for connected app', severity: 'critical', category: 'security', type: 'modify' },
    insertAuthProvider: { text: 'Created auth provider', severity: 'critical', category: 'security', type: 'create' },
    deleteAuthProvider: { text: 'Deleted auth provider', severity: 'warning', category: 'security', type: 'delete' },
    changeAuthProviderConsumerKey: { text: 'Changed auth provider consumer key', severity: 'critical', category: 'security', type: 'modify' },
    changeAuthProviderConsumerSecret: { text: 'Changed auth provider consumer secret', severity: 'critical', category: 'security', type: 'modify' },
    samlSsoConfig_create: { text: 'Created SAML SSO config', severity: 'critical', category: 'security', type: 'create' },
    samlSsoConfig_delete: { text: 'Deleted SAML SSO config', severity: 'critical', category: 'security', type: 'delete' },
    samlSsoConfig_signCert: { text: 'Changed SAML SSO signing certificate', severity: 'critical', category: 'security', type: 'modify' },
    samlSsoConfig_audience: { text: 'Changed SAML SSO audience URL', severity: 'critical', category: 'security', type: 'modify' },
    enableIdp: { text: 'Enabled Identity Provider', severity: 'warning', category: 'security', type: 'modify' },
    disableIdp: { text: 'Disabled Identity Provider', severity: 'warning', category: 'security', type: 'modify' },
    insertSharingRule: { text: 'Created sharing rule', severity: 'warning', category: 'security', type: 'create' },
    deleteSharingRule: { text: 'Deleted sharing rule', severity: 'warning', category: 'security', type: 'delete' },
    updateSharingRule: { text: 'Updated sharing rule', severity: 'warning', category: 'security', type: 'modify' },
    insertSharingSets: { text: 'Created sharing set', severity: 'warning', category: 'security', type: 'create' },
    updateSharingSets: { text: 'Updated sharing set', severity: 'warning', category: 'security', type: 'modify' },
    deleteSharingSets: { text: 'Deleted sharing set', severity: 'warning', category: 'security', type: 'delete' },
    insertTwoFactorInfo2: { text: 'Added time-based token for user', severity: 'info', category: 'security', type: 'create' },
    deleteTwoFactorInfo2: { text: 'Removed time-based token for user', severity: 'critical', category: 'security', type: 'delete' },
    deleteTwoFactorWebAuthN: { text: 'Removed WebAuthN security key for user', severity: 'critical', category: 'security', type: 'delete' },
    insertTwoFactorWebAuthN: { text: 'Added WebAuthN security key for user', severity: 'info', category: 'security', type: 'create' },
    insertTwoFactorTempCode: { text: 'Generated temporary verification code', severity: 'info', category: 'security', type: 'create' },
    passwordexpiry: { text: 'Changed org password expiration policy', severity: 'critical', category: 'security', type: 'modify' },
    passwordhistory: { text: 'Changed password history policy', severity: 'critical', category: 'security', type: 'modify' },
    passwordcomplexity: { text: 'Changed password complexity requirements', severity: 'critical', category: 'security', type: 'modify' },
    passwordlockout: { text: 'Changed password lockout policy', severity: 'critical', category: 'security', type: 'modify' },
    passwordminlength: { text: 'Changed minimum password length', severity: 'critical', category: 'security', type: 'modify' },
    passwordmaxinvalid: { text: 'Changed max invalid login attempts', severity: 'critical', category: 'security', type: 'modify' },
    passwordexpiryForProfile: { text: 'Changed password expiration for profile', severity: 'warning', category: 'permission', type: 'modify' },
    sessiontimeoutForProfile: { text: 'Changed session timeout for profile', severity: 'critical', category: 'permission', type: 'modify' },
    loginIpRange: { text: 'Changed login IP range for profile', severity: 'critical', category: 'permission', type: 'modify' },
    createdrole: { text: 'Created role', severity: 'info', category: 'user', type: 'create' },
    deletedrole: { text: 'Deleted role', severity: 'warning', category: 'user', type: 'delete' },
    addedtodelegatedgroup: { text: 'Added user to delegated group', severity: 'warning', category: 'permission', type: 'modify' },
    removedfromdelegatedgroup: { text: 'Removed user from delegated group', severity: 'warning', category: 'permission', type: 'modify' },
    createdDuplicateRule: { text: 'Created duplicate rule', severity: 'info', category: 'metadata', type: 'create' },
    createdMatchRule: { text: 'Created matching rule', severity: 'info', category: 'metadata', type: 'create' },
    domainChosen: { text: 'Chose My Domain name', severity: 'info', category: 'security', type: 'modify' },
    customDomainRedirectPolicy: { text: 'Changed custom domain redirect policy', severity: 'info', category: 'security', type: 'modify' },
    changedOrganizationAddress: { text: 'Changed org address', severity: 'info', category: 'org', type: 'modify' },
    changedconvrates: { text: 'Changed currency conversion rates', severity: 'info', category: 'org', type: 'modify' },
    createdFlexiPage: { text: 'Created Lightning page', severity: 'info', category: 'metadata', type: 'create' },
    deletedFlexiPage: { text: 'Deleted Lightning page', severity: 'info', category: 'metadata', type: 'delete' },
    changedFlexiPage: { text: 'Changed Lightning page', severity: 'info', category: 'metadata', type: 'modify' },
    changedLightningWebComponent: { text: 'Changed Lightning Web Component', severity: 'info', category: 'metadata', type: 'modify' },
    createdLightningWebComponent: { text: 'Created Lightning Web Component', severity: 'info', category: 'metadata', type: 'create' },
    changedAuraComponent: { text: 'Changed Aura component', severity: 'info', category: 'metadata', type: 'modify' },
    createdAuraComponent: { text: 'Created Aura component', severity: 'info', category: 'metadata', type: 'create' },
    createdcustentlayout: { text: 'Created page layout for object', severity: 'info', category: 'metadata', type: 'create' },
    deletedcustentlayout: { text: 'Deleted page layout for object', severity: 'info', category: 'metadata', type: 'delete' },
    changedStaticResource: { text: 'Changed static resource', severity: 'info', category: 'metadata', type: 'modify' },
    createdTabSet: { text: 'Created custom app', severity: 'info', category: 'metadata', type: 'create' },
    deletedTabSet: { text: 'Deleted custom app', severity: 'info', category: 'metadata', type: 'delete' },
    changedTabSetTabs: { text: 'Changed app tab membership', severity: 'info', category: 'metadata', type: 'modify' },
    changedTabSetName: { text: 'Changed app name', severity: 'info', category: 'metadata', type: 'modify' },
    createdQuickAction: { text: 'Created quick action', severity: 'info', category: 'metadata', type: 'create' },
    deletedQuickAction: { text: 'Deleted quick action', severity: 'info', category: 'metadata', type: 'delete' },
    createdFieldSet: { text: 'Created field set', severity: 'info', category: 'metadata', type: 'create' },
    deletedFieldSet: { text: 'Deleted field set', severity: 'info', category: 'metadata', type: 'delete' },
    updatedFieldSet: { text: 'Updated field set', severity: 'info', category: 'metadata', type: 'modify' },
    createdBigObj: { text: 'Created Big Object', severity: 'warning', category: 'metadata', type: 'create' },
    deletedBigObj: { text: 'Deleted Big Object', severity: 'warning', category: 'metadata', type: 'delete' },
    createdCustMdType: { text: 'Created custom metadata type', severity: 'info', category: 'metadata', type: 'create' },
    deletedCustMdType: { text: 'Deleted custom metadata type', severity: 'info', category: 'metadata', type: 'delete' },
    secureGuestUserRecordAccessEnabled: { text: 'Secured guest user record access', severity: 'critical', category: 'security', type: 'modify' },
    adminApprovedAppsOnlyOffOn: { text: 'Enabled admin-approved apps only restriction', severity: 'warning', category: 'security', type: 'modify' },
    adminApprovedAppsOnlyOnOff: { text: 'Disabled admin-approved apps only restriction', severity: 'critical', category: 'security', type: 'modify' },
    restrictEmailDomainsEnabledOffOn: { text: 'Enabled email domain restriction', severity: 'warning', category: 'security', type: 'modify' },
    restrictEmailDomainsEnabledOnOff: { text: 'Disabled email domain restriction', severity: 'critical', category: 'security', type: 'modify' },
    obscuresecretanswerenable: { text: 'Enabled secret answer obscuring', severity: 'info', category: 'security', type: 'modify' },
    obscuresecretanswerdisable: { text: 'Disabled secret answer obscuring', severity: 'warning', category: 'security', type: 'modify' },
    enableRequireLoginFromOrgDomain: { text: 'Enabled require login from org domain', severity: 'warning', category: 'security', type: 'modify' },
    disableRequireLoginFromOrgDomain: { text: 'Disabled require login from org domain', severity: 'critical', category: 'security', type: 'modify' },
    enableAPILoginRequiresOrgDomain: { text: 'Enabled API login requires org domain', severity: 'warning', category: 'security', type: 'modify' },
    disableAPILoginRequiresOrgDomain: { text: 'Disabled API login requires org domain', severity: 'critical', category: 'security', type: 'modify' },
    mFADirectUILoginOptInOffOn: { text: 'Enabled MFA direct UI login opt-in', severity: 'info', category: 'security', type: 'modify' },
    mFADirectUILoginOptInOnOff: { text: 'Disabled MFA direct UI login opt-in', severity: 'warning', category: 'security', type: 'modify' },
    overridegrantaccessenabledoff: { text: 'Disabled login-as override grant access', severity: 'info', category: 'security', type: 'modify' },
    enableOverrideGrantAccessOnOff: { text: 'Enabled login-as override grant access', severity: 'critical', category: 'security', type: 'modify' },
    permSetLicenseUserPermRevoked: { text: 'Revoked user permission via license', severity: 'critical', category: 'permission', type: 'modify' },
    userLicenseEntityPermRevoked: { text: 'Revoked object permission via license', severity: 'critical', category: 'permission', type: 'modify' },
    profileEntityPermRemoved: { text: 'Removed object permission from profile', severity: 'critical', category: 'permission', type: 'delete' },
    newProfileUIOffOn: { text: 'Enabled enhanced profile UI', severity: 'info', category: 'org', type: 'modify' },
    einsteinGPTCopilotEnabledOffOn: { text: 'Enabled Einstein GPT Copilot', severity: 'info', category: 'org', type: 'modify' },
    einsteinGPTCopilotEnabledOnOff: { text: 'Disabled Einstein GPT Copilot', severity: 'info', category: 'org', type: 'modify' },
    ExternalServicesCreate: { text: 'Created external service registration', severity: 'warning', category: 'security', type: 'create' },
    ExternalServicesDelete: { text: 'Deleted external service registration', severity: 'warning', category: 'security', type: 'delete' },
    entity_history_field_tracked: { text: 'Enabled field history tracking', severity: 'info', category: 'metadata', type: 'modify' },
    entity_history_field_untracked: { text: 'Disabled field history tracking', severity: 'info', category: 'metadata', type: 'modify' },
    restrictedProfileCloningOffOn: { text: 'Enabled profile cloning restriction', severity: 'info', category: 'security', type: 'modify' },
    userSelfDeactivateOffOn: { text: 'Enabled user self-deactivation', severity: 'info', category: 'user', type: 'modify' },
    minimumPasswordLifetimeEnable: { text: 'Enabled minimum password lifetime for profile', severity: 'warning', category: 'permission', type: 'modify' },
    requiredSessionLevelForProfile: { text: 'Changed session level requirement for profile', severity: 'critical', category: 'permission', type: 'modify' },
    insertConnectedAppSessionPolicy: { text: 'Set connected app session policy', severity: 'critical', category: 'security', type: 'modify' },
    namedCredentialInsert: { text: 'Created named credential', severity: 'info', category: 'security', type: 'create' },
    namedCredentialDelete: { text: 'Deleted named credential', severity: 'info', category: 'security', type: 'delete' },
    namedCredentialFieldChange: { text: 'Changed named credential', severity: 'info', category: 'security', type: 'modify' },
    externalCredentialInsert: { text: 'Created external credential', severity: 'info', category: 'security', type: 'create' },
    externalCredentialDelete: { text: 'Deleted external credential', severity: 'info', category: 'security', type: 'delete' },
    externalCredentialFieldChange: { text: 'Changed external credential', severity: 'info', category: 'security', type: 'modify' },
    addOauthClientCredentialUser: { text: 'Assigned OAuth client credentials user', severity: 'critical', category: 'security', type: 'modify' },
    transactionSecurityPolicyCreated: { text: 'Created transaction security policy', severity: 'warning', category: 'security', type: 'create' },
    transactionSecurityPolicyDeleted: { text: 'Deleted transaction security policy', severity: 'warning', category: 'security', type: 'delete' },
    transactionSecurityPolicyEnabled: { text: 'Enabled transaction security policy', severity: 'warning', category: 'security', type: 'modify' },
    transactionSecurityPolicyDisabled: { text: 'Disabled transaction security policy', severity: 'warning', category: 'security', type: 'modify' },
    userAccessPoliciesEnabledOffOn: { text: 'Enabled user access policies', severity: 'info', category: 'org', type: 'modify' },
    userAccessPoliciesEnabledOnOff: { text: 'Disabled user access policies', severity: 'info', category: 'org', type: 'modify' },
    changedUserPhoneNumber: { text: 'Changed phone number for user', severity: 'info', category: 'user', type: 'modify' },
    changedcommunitynickname: { text: 'Changed community nickname', severity: 'info', category: 'user', type: 'modify' },
    Login: { text: 'Login event', severity: 'info', category: 'login', type: 'login' },
    loginasgrantedtopartnerbt: { text: 'Granted login access to package publisher', severity: 'warning', category: 'security', type: 'modify' },
    loginasrevokedtopartnerbt: { text: 'Revoked login access from package publisher', severity: 'info', category: 'security', type: 'modify' },
};

const NOISE_PATTERNS = [
    'Login', 'logout', 'Navigation', 'ReportView', 'ListView',
    'SessionRefreshed', 'DashboardView', 'TabView',
];

const CRITICAL_WEIGHT = 40;
const WARNING_WEIGHT = 20;

const ENHANCED_SECTIONS = {
    'Manage Users': { icon: 'user', color: 'tag-blue' },
    'Login': { icon: 'login', color: 'tag-green' },
    'Security': { icon: 'shield', color: 'tag-rose' },
    'Data Management': { icon: 'database', color: 'tag-amber' },
    'Profiles': { icon: 'profile', color: 'tag-purple' },
    'Permissions': { icon: 'lock', color: 'tag-purple' },
    'Automation': { icon: 'zap', color: 'tag-amber' },
    'Metadata': { icon: 'file', color: 'tag-blue' },
    'Organization': { icon: 'org', color: 'tag-green' },
};

// DOM refs
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const orgUrl = document.getElementById('orgUrl');
const reconnectBtn = document.getElementById('reconnectBtn');
const auditLogBody = document.getElementById('auditLogBody');
const loadingIndicator = document.getElementById('loadingIndicator');
const noResults = document.getElementById('noResults');
const disconnectedMsg = document.getElementById('disconnectedMsg');
const paginationInfo = document.getElementById('paginationInfo');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const recordCount = document.getElementById('recordCount');
const searchFilter = document.getElementById('searchFilter');
const severityFilter = document.getElementById('severityFilter');
const categoryFilter = document.getElementById('categoryFilter');
const typeFilter = document.getElementById('typeFilter');
const userFilter = document.getElementById('userFilter');
const userFilterSearch = document.getElementById('userFilterSearch');
const userFilterOptions = document.getElementById('userFilterOptions');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const noiseFilter = document.getElementById('noiseFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const refreshBtn = document.getElementById('refreshBtn');
const cardCritical = document.getElementById('cardCritical');
const cardFailed = document.getElementById('cardFailed');
const cardPerms = document.getElementById('cardPerms');
const cardDeploy = document.getElementById('cardDeploy');
const cardAPI = document.getElementById('cardAPI');
const cardSharing = document.getElementById('cardSharing');
const aiInsights = document.getElementById('aiInsights');
const sidePanel = document.getElementById('sidePanel');
const panelBody = document.getElementById('panelBody');
const panelTitle = document.getElementById('panelTitle');
const panelClose = document.getElementById('panelClose');

// State
let users = [];
let isPanelOpen = false;
let activePreset = 'security-review';
let activeView = 'timeline';

// Init
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const data = await chrome.storage.local.get(['instanceUrl', 'accessToken']);
    if (data.instanceUrl && data.accessToken) {
        salesforceAPI = new SalesforceAPI(data.instanceUrl, data.accessToken);
        updateConnectionStatus(true, data.instanceUrl);
        disconnectedMsg.style.display = 'none';
        try {
            await loadUsers();
            await loadEvents();
            setupEventListeners();
        } catch (error) {
            if (isSessionExpired(error)) {
                const authData = await getSalesforceAuth(data.instanceUrl);
                if (authData) {
                    salesforceAPI = new SalesforceAPI(data.instanceUrl, authData.accessToken);
                    await chrome.storage.local.set({
                        instanceUrl: data.instanceUrl,
                        accessToken: authData.accessToken,
                        authMethod: authData.method
                    });
                    try {
                        await loadUsers();
                        await loadEvents();
                        setupEventListeners();
                        return;
                    } catch (e) {
                        // fall through to disconnect
                    }
                }
                handleSessionExpiry(data.instanceUrl);
            }
        }
    } else {
        updateConnectionStatus(false);
        disconnectedMsg.style.display = 'block';
        document.getElementById('connectedContent').style.display = 'none';
    }

    setupStaticEventListeners();
    loadTheme();
}

function getActionInfo(actionName) {
    const normalized = actionName ? actionName.replace(/[^a-zA-Z0-9_]/g, '') : '';
    const direct = ACTION_MAP[normalized];
    if (direct) return direct;

    const lower = normalized.toLowerCase();
    if (lower.includes('login') || lower.includes('logout')) {
        return { text: `Login event: ${actionName}`, severity: 'info', category: 'login', type: 'login' };
    }
    if (lower.includes('perm') || lower.includes('profile')) {
        return { text: `Permission change: ${actionName}`, severity: 'warning', category: 'permission', type: 'modify' };
    }
    if (lower.includes('create') || lower.includes('insert') || lower.includes('new')) {
        return { text: `Created: ${actionName}`, severity: 'info', category: 'metadata', type: 'create' };
    }
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('removed')) {
        return { text: `Deleted: ${actionName}`, severity: 'warning', category: 'metadata', type: 'delete' };
    }
    if (lower.includes('change') || lower.includes('update') || lower.includes('modify') || lower.includes('edit')) {
        return { text: `Modified: ${actionName}`, severity: 'info', category: 'metadata', type: 'modify' };
    }
    if (lower.includes('activate') || lower.includes('deactivate') || lower.includes('enable') || lower.includes('disable')) {
        return { text: `Status change: ${actionName}`, severity: 'warning', category: 'metadata', type: 'modify' };
    }

    return { text: actionName || 'Unknown', severity: 'info', category: 'metadata', type: 'modify' };
}

function classifyEvent(record) {
    const actionInfo = getActionInfo(record.Action);
    return {
        ...actionInfo,
        isNoise: NOISE_PATTERNS.some(p =>
            (record.Action || '').toLowerCase().includes(p.toLowerCase())
        ) && actionInfo.severity === 'info'
    };
}

function calculateScore(record, eventClass) {
    let score = 0;
    if (eventClass.severity === 'critical') score += 50;
    else if (eventClass.severity === 'warning') score += 25;

    if (eventClass.category === 'security') score += 20;
    if (eventClass.category === 'permission') score += 15;
    if (eventClass.type === 'delete') score += 10;
    if (eventClass.type === 'create') score += 5;
    if (eventClass.type === 'assign') score += 10;

    if ((record.Status || '').toLowerCase() === 'failure') score += 15;

    return Math.min(score, 100);
}

function getSeverityClass(severity) {
    if (severity === 'critical') return 'critical';
    if (severity === 'warning') return 'warning';
    return 'info';
}

function getScoreClass(score) {
    if (score >= 60) return 'high';
    if (score >= 30) return 'med';
    return 'low';
}

function getCategoryFromSection(section) {
    const s = (section || '').toLowerCase();
    if (s.includes('user')) return 'user';
    if (s.includes('login')) return 'login';
    if (s.includes('security') || s.includes('sharing')) return 'security';
    if (s.includes('perm') || s.includes('profile')) return 'permission';
    if (s.includes('data') || s.includes('field') || s.includes('object')) return 'metadata';
    if (s.includes('deploy')) return 'deployment';
    return 'metadata';
}

function enhanceRecord(record) {
    const eventClass = classifyEvent(record);
    const score = calculateScore(record, eventClass);
    const sectionCategory = getCategoryFromSection(record.Section);

    return {
        ...record,
        _class: eventClass,
        _score: score,
        _severity: eventClass.severity,
        _sectionCategory: sectionCategory,
        _humanAction: eventClass.text,
        _isNoise: eventClass.isNoise,
    };
}

function parseDiff(displayText) {
    if (!displayText) return { old: null, new: null, description: displayText };
    const diff = { old: null, new: null, description: displayText };

    const patterns = [
        /changed\s+from\s+['"]?(.+?)['"]?\s+to\s+['"]?(.+?)['"]?/i,
        /from\s+['"]?(.+?)['"]?\s+to\s+['"]?(.+?)['"]?/i,
        /old\s*=\s*(.+?)(?:,|\s+new\s*=\s*(.+))/i,
        /removed\s+(.+?)(?:,\s+added\s+(.+))?/i,
        /added\s+(.+?)(?:,\s+removed\s+(.+))?/i,
    ];

    for (const p of patterns) {
        const m = displayText.match(p);
        if (m) {
            diff.old = m[1]?.trim();
            diff.new = m[2]?.trim();
            break;
        }
    }

    return diff;
}

function extractObjectName(record) {
    const display = record.Display || '';
    const action = record.Action || '';
    const section = record.Section || '';

    const objMatch = display.match(/for\s+([A-Za-z0-9_.]+?)(?:\s|$|,)/);
    if (objMatch) return objMatch[1];

    const objMatch2 = display.match(/([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)(?:\s|$|,)/);
    if (objMatch2 && objMatch2[1] !== 'Old' && objMatch2[1] !== 'New') return objMatch2[1];

    const objMatch3 = action.match(/^([A-Za-z0-9_]+)/);
    if (objMatch3 && !ACTION_MAP[objMatch3[1]]) return objMatch3[1];

    return null;
}

function formatDateTime(dateStr) {
    if (!dateStr) return { date: 'N/A', time: '' };
    const d = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    return {
        date: `${day} ${months[d.getMonth()]} ${d.getFullYear()}`,
        time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
    };
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
}

function getSectionTagClass(section) {
    const s = (section || '').toLowerCase();
    if (s.includes('user')) return 'tag-blue';
    if (s.includes('login')) return 'tag-green';
    if (s.includes('security')) return 'tag-rose';
    if (s.includes('perm')) return 'tag-purple';
    if (s.includes('data') || s.includes('field') || s.includes('object')) return 'tag-amber';
    return 'tag-blue';
}

function getCategories() {
    const cats = new Set();
    allRecords.forEach(r => {
        if (r._class?.category) cats.add(r._class.category);
    });
    return ['user', 'login', 'security', 'permission', 'metadata', 'automation', 'org', 'deployment'].filter(c => cats.has(c));
}

function applyClientFilters(records) {
    const severity = severityFilter.value;
    const category = categoryFilter.value;
    const type = typeFilter.value;
    const userId = userFilter.value;
    const search = searchFilter.value.trim().toLowerCase();
    const hideNoise = noiseFilter.checked;
    const sd = startDate.value;
    const ed = endDate.value;

    return records.filter(r => {
        if (severity && r._severity !== severity) return false;
        if (category && r._class.category !== category) return false;
        if (type && r._class.type !== type) return false;
        if (userId) {
            const uid = r.CreatedById || r.CreatedBy?.Id;
            if (uid !== userId) return false;
        }
        if (hideNoise && r._isNoise) return false;
        if (sd) {
            const rd = new Date(r.CreatedDate);
            if (rd < new Date(sd)) return false;
        }
        if (ed) {
            const rd = new Date(r.CreatedDate);
            const endDateObj = new Date(ed);
            endDateObj.setHours(23, 59, 59, 999);
            if (rd > endDateObj) return false;
        }
        if (search) {
            const haystack = [
                r.Action, r.Display, r.Section, r._class?.text,
                r.CreatedBy?.Name, r.DelegateUser
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

function groupByField(records, field) {
    const groups = {};
    records.forEach(r => {
        const key = r[field] || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
    });
    return Object.entries(groups)
        .map(([key, items]) => ({ key, items, count: items.length }))
        .sort((a, b) => b.count - a.count);
}

function groupByUser(records) {
    const groups = {};
    records.forEach(r => {
        const name = r.CreatedBy?.Name || 'Unknown';
        if (!groups[name]) groups[name] = [];
        groups[name].push(r);
    });
    return Object.entries(groups)
        .map(([name, items]) => ({ name, items, count: items.length }))
        .sort((a, b) => b.count - a.count);
}

function groupByObject(records) {
    const groups = {};
    records.forEach(r => {
        const obj = extractObjectName(r) || 'Other';
        if (!groups[obj]) groups[obj] = [];
        groups[obj].push(r);
    });
    return Object.entries(groups)
        .map(([obj, items]) => ({ obj, items, count: items.length }))
        .sort((a, b) => b.count - a.count);
}

function groupByPermission(records) {
    return records.filter(r =>
        r._class.category === 'permission' ||
        r._class.category === 'security'
    );
}

function groupByDeployment(records) {
    const groups = {};
    const deployKeywords = ['apexclass','apextrigger','interactiondefinition',
        'processdefinition','workflowrule','flexipage','lightning','aura',
        'staticresource','customlabel','csp','remote'];
    records.forEach(r => {
        const action = (r.Action || '').toLowerCase();
        const display = (r.Display || '').toLowerCase();
        const isDeploy = deployKeywords.some(k => action.includes(k) || display.includes(k));
        if (!isDeploy) return;
        const key = `${r.CreatedDate?.split('T')[0] || 'unknown'}-${r.CreatedBy?.Name || 'unknown'}`;
        if (!groups[key]) groups[key] = { date: r.CreatedDate?.split('T')[0] || 'unknown', user: r.CreatedBy?.Name || 'Unknown', items: [] };
        groups[key].items.push(r);
    });
    return Object.entries(groups)
        .map(([_, g]) => ({ ...g, count: g.items.length }))
        .sort((a, b) => b.count - a.count);
}

function generateInsights(records) {
    const insights = [];
    const critical = records.filter(r => r._severity === 'critical');
    const failed = records.filter(r => (r.Status || '').toLowerCase() === 'failure');
    const permChanges = records.filter(r => r._class.category === 'permission');
    const loginAs = records.filter(r =>
        (r.Action || '').toLowerCase().includes('suorgadminlogin') ||
        (r.Action || '').toLowerCase().includes('suloginaccessused')
    );
    const passwordChanges = records.filter(r =>
        (r.Action || '').toLowerCase().includes('password')
    );
    const userCreates = records.filter(r =>
        r.Action === 'createduser' || r.Action === 'deactivateduser'
    );
    const authChanges = records.filter(r =>
        (r.Action || '').toLowerCase().includes('authprovider') ||
        (r.Action || '').toLowerCase().includes('saml') ||
        (r.Action || '').toLowerCase().includes('connectedapp')
    );

    if (loginAs.length > 0) {
        const users = [...new Set(loginAs.map(r => r.CreatedBy?.Name))].join(', ');
        insights.push({
            text: `${loginAs.length} Login-As event(s) detected by ${users}`,
            severity: 'critical'
        });
    }
    if (passwordChanges.length > 0) {
        insights.push({
            text: `${passwordChanges.length} password policy or reset change(s) detected`,
            severity: 'warning'
        });
    }
    if (authChanges.length > 0) {
        insights.push({
            text: `${authChanges.length} authentication provider or SSO change(s) detected`,
            severity: 'critical'
        });
    }
    if (critical.length > 5) {
        insights.push({
            text: `High volume (${critical.length}) of critical changes - possible bulk security operation`,
            severity: 'warning'
        });
    }
    if (failed.length > 3) {
        insights.push({
            text: `${failed.length} failed operation(s) - investigate for potential misconfiguration or abuse`,
            severity: 'warning'
        });
    }
    if (userCreates.length > 2) {
        insights.push({
            text: `${userCreates.length} user creation/deactivation events - review for unauthorized changes`,
            severity: 'warning'
        });
    }
    if (permChanges.length > 5) {
        insights.push({
            text: `High volume (${permChanges.length}) of permission changes - review for privilege escalation`,
            severity: 'warning'
        });
    }

    if (insights.length === 0) {
        insights.push({
            text: 'No significant security issues detected in this time range',
            severity: 'info'
        });
    }

    return insights;
}

function analyzeForAttacks(records) {
    const incidents = [];
    const byUser = groupByUser(records);

    // 1. Privilege Escalation: profile change + permission set assign in same session
    for (const { name, items } of byUser) {
        const profileChanges = items.filter(r =>
            r.Action?.toLowerCase().includes('profile') && !r.Action?.toLowerCase().includes('fls')
        );
        const permSetAssigns = items.filter(r =>
            r.Action === 'PermSetAssign' || r.Action === 'PermSetGroupAssign'
        );
        const loginAs = items.filter(r =>
            r.Action?.toLowerCase().includes('suorgadminlogin') ||
            r.Action?.toLowerCase().includes('suloginaccessused')
        );
        const userActivations = items.filter(r =>
            r.Action === 'activateduser' || r.Action === 'deactivateduser'
        );
        const passwordResets = items.filter(r =>
            r.Action === 'resetpassword' || r.Action === 'changedpassword'
        );
        const permEscalations = items.filter(r =>
            r.Action === 'PermSetEnableUserPerm' ||
            r.Action === 'PermSetEntityPermChanged'
        );

        // Account Takeover: activation + password reset + permission escalation + login-as
        if (userActivations.length > 0 && passwordResets.length > 0 && loginAs.length > 0) {
            const times = items.map(r => new Date(r.CreatedDate).getTime()).sort();
            if (times.length > 1 && (times[times.length - 1] - times[0]) < 3600000) {
                incidents.push({
                    type: 'account-takeover',
                    severity: 'critical',
                    title: 'Potential Account Takeover',
                    user: name,
                    details: `${userActivations.length} activation(s), ${passwordResets.length} password reset(s), ${loginAs.length} Login-As event(s) in under 1 hour`,
                    score: 95,
                    indicators: [
                        `${userActivations.length} user activation(s)`,
                        `${passwordResets.length} password reset(s)`,
                        `${loginAs.length} Login-As event(s)`,
                        `${permEscalations.length} permission escalation(s)`
                    ]
                });
            }
        }

        // Privilege Escalation: profile changes + permission set assigns
        if (profileChanges.length > 0 && permSetAssigns.length > 0) {
            incidents.push({
                type: 'privilege-escalation',
                severity: 'critical',
                title: 'Privilege Escalation Activity',
                user: name,
                details: `${profileChanges.length} profile change(s) + ${permSetAssigns.length} permission set assignment(s)`,
                score: 88,
                indicators: [
                    `${profileChanges.length} profile change(s)`,
                    `${permSetAssigns.length} permission set assign(s)`
                ]
            });
        }

        // Lateral Movement: login-as followed by user/admin changes
        if (loginAs.length > 0 && (profileChanges.length > 0 || permSetAssigns.length > 0)) {
            incidents.push({
                type: 'lateral-movement',
                severity: 'critical',
                title: 'Suspicious Lateral Movement',
                user: name,
                details: `${loginAs.length} Login-As event(s) followed by admin changes`,
                score: 82,
                indicators: [
                    `${loginAs.length} Login-As event(s)`,
                    `${profileChanges.length} profile change(s)`,
                    `${permSetAssigns.length} permission set assign(s)`
                ]
            });
        }
    }

    // 2. Insider Threat: bulk permission changes + export-like actions
    const bulkPermChanges = records.filter(r =>
        (r.Action === 'PermSetAssign' || r.Action === 'PermSetGroupAssign') &&
        (r.Display || '').toLowerCase().includes('multiple')
    );
    if (bulkPermChanges.length > 3) {
        const users = [...new Set(bulkPermChanges.map(r => r.CreatedBy?.Name))].join(', ');
        incidents.push({
            type: 'insider-threat',
            severity: 'critical',
            title: 'Potential Insider Threat - Bulk Permission Grants',
            user: users,
            details: `${bulkPermChanges.length} bulk permission grants detected`,
            score: 90,
            indicators: [`${bulkPermChanges.length} bulk permission grants`, `By: ${users}`]
        });
    }

    // 3. Defense Evasion: sharing rule changes + public link creation
    const sharingChanges = records.filter(r =>
        r.Action?.toLowerCase().includes('sharing') ||
        (r.Section || '').toLowerCase().includes('sharing')
    );
    if (sharingChanges.length > 2) {
        incidents.push({
            type: 'defense-evasion',
            severity: 'warning',
            title: 'Sharing Rule Changes Detected',
            user: '',
            details: `${sharingChanges.length} sharing or public access changes`,
            score: 65,
            indicators: [`${sharingChanges.length} sharing rule change(s)`]
        });
    }

    // 4. Reconnaissance: failed logins spike
    const failedLogins = records.filter(r =>
        (r.Action || '').toLowerCase().includes('login') &&
        (r.Status || '').toLowerCase() === 'failure'
    );
    if (failedLogins.length > 5) {
        const users = [...new Set(failedLogins.map(r => r.CreatedBy?.Name))].join(', ');
        incidents.push({
            type: 'reconnaissance',
            severity: 'warning',
            title: 'High Volume of Failed Logins',
            user: users,
            details: `${failedLogins.length} failed login attempts - possible brute force`,
            score: 70,
            indicators: [`${failedLogins.length} failed login(s)`, `By: ${users}`]
        });
    }

    // 5. Security Policy Weakening
    const policyWeaken = records.filter(r =>
        r.Action === 'disableRequireLoginFromOrgDomain' ||
        r.Action === 'disableAPILoginRequiresOrgDomain' ||
        r.Action === 'restrictEmailDomainsEnabledOnOff' ||
        r.Action === 'adminApprovedAppsOnlyOnOff' ||
        r.Action === 'mFADirectUILoginOptInOnOff' ||
        r.Action === 'obscuresecretanswerdisable'
    );
    if (policyWeaken.length > 0) {
        incidents.push({
            type: 'policy-weakening',
            severity: 'critical',
            title: 'Security Policy Weakened',
            user: policyWeaken.map(r => r.CreatedBy?.Name).filter(Boolean).join(', '),
            details: `${policyWeaken.length} security control(s) disabled or weakened`,
            score: 85,
            indicators: policyWeaken.map(r => r._humanAction)
        });
    }

    // 6. Connected App / Auth Provider Changes
    const authChanges = records.filter(r =>
        r.Action?.toLowerCase().includes('connectedapp') ||
        r.Action?.toLowerCase().includes('authprovider') ||
        r.Action?.toLowerCase().includes('saml')
    );
    if (authChanges.length > 1) {
        const users = [...new Set(authChanges.map(r => r.CreatedBy?.Name))].join(', ');
        incidents.push({
            type: 'identity-compromise',
            severity: 'critical',
            title: 'Identity/Auth Configuration Changes',
            user: users,
            details: `${authChanges.length} identity provider or connected app changes`,
            score: 80,
            indicators: authChanges.map(r => r._humanAction)
        });
    }

    return incidents.sort((a, b) => b.score - a.score);
}

function updateCards(records) {
    const critical = records.filter(r => r._severity === 'critical');
    const failed = records.filter(r => (r.Status || '').toLowerCase() === 'failure');
    const perm = records.filter(r => r._class.category === 'permission');
    const deploy = records.filter(r =>
        r._class.category === 'metadata' &&
        (r._class.type === 'create' || r._class.type === 'delete')
    );
    const sharing = records.filter(r =>
        (r.Section || '').toLowerCase().includes('sharing') ||
        (r.Action || '').toLowerCase().includes('sharing')
    );
    const api = records.filter(r =>
        (r.Action || '').toLowerCase().includes('api') ||
        (r.Display || '').toLowerCase().includes('api')
    );

    cardCritical.textContent = critical.length;
    cardFailed.textContent = failed.length;
    cardPerms.textContent = perm.length;
    cardDeploy.textContent = deploy.length;
    cardSharing.textContent = sharing.length;
    cardAPI.textContent = api.length;
}

function updateInsights(records) {
    const insights = generateInsights(records);
    const incidents = analyzeForAttacks(records);
    const all = [...insights];
    incidents.forEach(inc => {
        all.push({
            text: `[INCIDENT ${inc.type.toUpperCase()}] ${inc.title}: ${inc.details}`,
            severity: inc.severity
        });
    });
    aiInsights.innerHTML = all.map(i =>
        `<div class="ai-insight">${i.text}<span class="tag ${i.severity === 'critical' ? 'critical-bg' : i.severity === 'warning' ? 'warning-bg' : ''}">${i.severity}</span></div>`
    ).join('');
    const totalAlerts = incidents.length + insights.filter(i => i.severity !== 'info').length;
    document.getElementById('aiCount').textContent = totalAlerts;
    const smallCount = document.getElementById('aiCountSmall');
    if (smallCount) smallCount.textContent = totalAlerts;
    window._lastIncidents = incidents;
}

async function loadEvents() {
    if (!salesforceAPI) return;
    showLoading(true);

    try {
        const filters = {
            limit: 10000
        };
        if (startDate.value) filters.startDate = startDate.value + 'T00:00:00Z';
        if (endDate.value) filters.endDate = endDate.value + 'T23:59:59Z';

        const result = await salesforceAPI.getAuditLogs(filters);
        allRecords = result.records.map(enhanceRecord);
        allFields = result.fields;
        totalRecords = result.totalSize;

        populateCategoryFilter();
        currentPage = 1;
        renderCurrentView();
        updateCards(allRecords);
        updateInsights(allRecords);
        populateSavedViews();
    } catch (error) {
        console.error('Error loading events:', error);
        if (isSessionExpired(error)) {
            handleSessionExpiry();
        }
    } finally {
        showLoading(false);
    }
}

function populateCategoryFilter() {
    const cats = getCategories();
    categoryFilter.innerHTML = '<option value="">All Categories</option>' +
        cats.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('');
}

function renderCurrentView() {
    const records = applyClientFilters(allRecords);
    totalRecords = records.length;

    if (activeView === 'timeline') {
        renderTimeline(records);
    } else if (activeView === 'by-user') {
        renderByUser(records);
    } else if (activeView === 'by-object') {
        renderByObject(records);
    } else if (activeView === 'by-permission') {
        renderByPermission(records);
    } else if (activeView === 'by-deployment') {
        renderByDeployment(records);
    }
}

function paginate(records) {
    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    return records.slice(start, start + RECORDS_PER_PAGE);
}

function renderTimeline(records) {
    hideNoResults();
    const paginated = paginate(records);
    recordCount.textContent = records.length;

    if (paginated.length === 0) {
        showNoResults();
        auditLogBody.innerHTML = '';
        updatePagination(records.length);
        return;
    }

    auditLogBody.innerHTML = paginated.map((r, idx) => {
        const fd = formatDateTime(r.CreatedDate);
        const sevClass = getSeverityClass(r._severity);
        const scoreClass = getScoreClass(r._score);
        const initials = getInitials(r.CreatedBy?.Name);
        const tagClass = getSectionTagClass(r.Section);
        const diff = parseDiff(r.Display);
        const canExpand = diff.old || diff.new || r.DelegateUser;

        return `<tr class="row-${sevClass}" data-idx="${idx}">
            <td style="text-align:center;font-size:10px;color:var(--text-muted);">${canExpand ? '+' : ''}</td>
            <td><span class="severity-badge ${sevClass}">${r._severity}</span></td>
            <td><span class="score-badge ${scoreClass}">${r._score}</span></td>
            <td>
                <div style="font-size:13px;font-weight:500;">${fd.date}</div>
                <div style="font-size:11px;color:var(--text-muted);">${fd.time}</div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${initials}</div>
                    <span>${r.CreatedBy?.Name || 'N/A'}</span>
                </div>
            </td>
            <td><span class="section-tag ${tagClass}">${r.Section || 'N/A'}</span></td>
            <td>
                <div class="action-text">${r._humanAction}</div>
                <div class="action-desc">${r.Action || ''}</div>
            </td>
            <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${r.Display ? r.Display.substring(0, 80) + (r.Display.length > 80 ? '...' : '') : '—'}
            </td>
        </tr>
        <tr class="detail-row" data-parent="${idx}">
            <td colspan="8" class="detail-cell">
                ${renderDetail(r, diff)}
            </td>
        </tr>`;
    }).join('');

    updatePagination(records.length);
    attachRowListeners();
}

function renderDetail(r, diff) {
    return `<div class="detail-grid">
        <div class="detail-section">
            <h4>Event</h4>
            <div class="value"><strong>Action:</strong> ${r._humanAction}</div>
            <div class="value" style="font-size:12px;color:var(--text-muted);margin-top:4px;"><strong>API Name:</strong> ${r.Action || 'N/A'}</div>
            <div class="value" style="font-size:12px;color:var(--text-muted);"><strong>Section:</strong> ${r.Section || 'N/A'}</div>
            ${r.Status ? `<div class="value" style="margin-top:4px;"><strong>Status:</strong> <span style="color:${r.Status === 'Success' ? 'var(--success)' : 'var(--critical)'}">${r.Status}</span></div>` : ''}
        </div>
        <div class="detail-section">
            <h4>User</h4>
            <div class="value"><strong>Name:</strong> ${r.CreatedBy?.Name || 'N/A'}</div>
            ${r.DelegateUser ? `<div class="value" style="margin-top:4px;"><strong>Delegate User:</strong> ${r.DelegateUser}</div>` : ''}
            <div style="margin-top:8px;">${r.DelegateUser ? '<span class="section-tag tag-rose" style="font-size:10px;">Impersonated</span>' : ''}</div>
        </div>
    </div>

    <div class="detail-grid" style="margin-top:12px;">
        ${diff.description ? `<div class="detail-section" style="grid-column:1/-1;">
            <h4>Description</h4>
            <div class="value">${diff.description}</div>
        </div>` : ''}
        ${diff.old ? `<div class="detail-section">
            <h4>Old Value</h4>
            <div class="value diff-old">${diff.old}</div>
        </div>` : ''}
        ${diff.new ? `<div class="detail-section">
            <h4>New Value</h4>
            <div class="value diff-new">${diff.new}</div>
        </div>` : ''}
    </div>

    <div class="detail-meta">
        <span class="detail-meta-item"><strong>Score:</strong> ${r._score}/100</span>
        <span class="detail-meta-item"><strong>Category:</strong> ${r._class.category || 'N/A'}</span>
        <span class="detail-meta-item"><strong>Type:</strong> ${r._class.type || 'N/A'}</span>
        <span class="detail-meta-item"><strong>Severity:</strong> ${r._severity}</span>
        <span class="detail-meta-item"><strong>Time:</strong> ${r.CreatedDate || 'N/A'}</span>
    </div>
    ${renderBlastRadius(r)}`;
}

function renderBlastRadius(r) {
    const blast = calculateBlastRadius(r);
    if (!blast) return '';
    const impactColor = blast.impact === 'High' ? 'var(--critical)' : blast.impact === 'Medium' ? 'var(--warning)' : 'var(--info)';
    return `<div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);">Blast Radius</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:3px;font-weight:600;background:${impactColor}20;color:${impactColor};">${blast.impact} Impact</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--text-secondary);">
            <span>Type: <strong>${blast.type}</strong></span>
            <span>Target: <strong>${blast.target}</strong></span>
            <span>Affected Users: <strong>${blast.affectedUsers}</strong></span>
            <span>Potential Impact: <strong style="color:${impactColor};">${blast.impact}</strong></span>
        </div>
    </div>`;
}

function renderByUser(records) {
    const groups = groupByUser(records);
    recordCount.textContent = records.length;
    auditLogBody.innerHTML = groups.map(g => `
        <tr style="cursor:pointer;" onclick="invByUser('${g.name.replace(/'/g, "\\'")}')">
            <td colspan="8">
                <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                    <div class="user-avatar">${getInitials(g.name)}</div>
                    <div style="flex:1;font-weight:600;">${g.name}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${g.count} events</div>
                    <div style="font-size:12px;color:var(--text-muted);">
                        ${g.items.filter(r => r._severity === 'critical').length} critical
                    </div>
                    <svg style="width:16px;height:16px;stroke:var(--text-muted);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
            </td>
        </tr>
    `).join('');
    updatePagination(records.length);
}

function renderByObject(records) {
    const groups = groupByObject(records);
    recordCount.textContent = records.length;
    auditLogBody.innerHTML = groups.map(g => `
        <tr style="cursor:pointer;" onclick="invByObject('${g.obj.replace(/'/g, "\\'")}')">
            <td colspan="8">
                <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                    <div style="width:26px;height:26px;border-radius:6px;background:var(--info-bg);display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:11px;font-weight:700;flex-shrink:0;">${g.obj.charAt(0).toUpperCase()}</div>
                    <div style="flex:1;font-weight:600;font-family:'SF Mono','Fira Code',monospace;font-size:12px;">${g.obj}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${g.count} changes</div>
                    <svg style="width:16px;height:16px;stroke:var(--text-muted);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
            </td>
        </tr>
    `).join('');
    updatePagination(records.length);
}

function renderByPermission(records) {
    const perm = groupByPermission(records);
    recordCount.textContent = perm.length;
    auditLogBody.innerHTML = perm.length === 0
        ? '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">No permission-related events found</td></tr>'
        : paginate(perm).map((r, idx) => {
            const fd = formatDateTime(r.CreatedDate);
            const sevClass = getSeverityClass(r._severity);
            const scoreClass = getScoreClass(r._score);
            return `<tr class="row-${sevClass}">
                <td></td>
                <td><span class="severity-badge ${sevClass}">${r._severity}</span></td>
                <td><span class="score-badge ${scoreClass}">${r._score}</span></td>
                <td><div style="font-size:13px;">${fd.date} ${fd.time}</div></td>
                <td>${r.CreatedBy?.Name || 'N/A'}</td>
                <td><span class="section-tag ${getSectionTagClass(r.Section)}">${r.Section || 'N/A'}</span></td>
                <td><div class="action-text">${r._humanAction}</div></td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.Display ? r.Display.substring(0, 80) : '—'}</td>
            </tr>`;
        }).join('');
    updatePagination(perm.length);
}

function renderByDeployment(records) {
    const groups = groupByDeployment(records);
    recordCount.textContent = records.length;
    auditLogBody.innerHTML = groups.length === 0
        ? '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">No deployment-related events found</td></tr>'
        : groups.map(g => `
            <tr style="cursor:pointer;" onclick="invByDeployment('${g.date}','${g.user.replace(/'/g, "\\'")}')">
                <td colspan="8">
                    <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                        <div style="width:26px;height:26px;border-radius:6px;background:var(--warning-bg);display:flex;align-items:center;justify-content:center;color:var(--warning);font-size:11px;font-weight:700;flex-shrink:0;">D</div>
                        <div style="flex:1;"><span style="font-weight:600;">${g.date}</span> by <span style="font-weight:500;">${g.user}</span></div>
                        <div style="font-size:12px;color:var(--text-muted);">${g.count} components</div>
                        <svg style="width:16px;height:16px;stroke:var(--text-muted);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </td>
            </tr>
        `).join('');
    updatePagination(records.length);
}

function attachRowListeners() {
    document.querySelectorAll('#auditLogBody > tr:not(.detail-row)').forEach(row => {
        row.addEventListener('click', () => {
            const idx = row.dataset.idx;
            const detailRow = document.querySelector(`tr.detail-row[data-parent="${idx}"]`);
            if (detailRow) {
                const isOpen = detailRow.classList.contains('open');
                document.querySelectorAll('tr.detail-row.open').forEach(r => r.classList.remove('open'));
                document.querySelectorAll('tr.expanded').forEach(r => r.classList.remove('expanded'));
                if (!isOpen) {
                    detailRow.classList.add('open');
                    row.classList.add('expanded');
                }
            }
        });
    });
}

function updatePagination(total) {
    const totalPages = Math.ceil(total / RECORDS_PER_PAGE) || 1;
    const first = total === 0 ? 0 : (currentPage - 1) * RECORDS_PER_PAGE + 1;
    const last = Math.min(currentPage * RECORDS_PER_PAGE, total);
    paginationInfo.textContent = total === 0 ? 'No results' : `Showing ${first} to ${last} of ${total} events`;
    pageInfo.textContent = `${currentPage} of ${totalPages}`;
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;
}

let userFilterIndex = -1;
let userSearchInitialized = false;

function renderUserOptions(filter) {
    const q = (filter || '').toLowerCase();
    const filtered = q ? users.filter(u => u.Name.toLowerCase().includes(q)) : users;
    userFilterOptions.innerHTML =
        `<div class="opt" data-value="">All Users (${users.length} total)</div>` +
        filtered.map(u => `<div class="opt" data-value="${u.Id}"><span>${u.Name}</span> <span class="opt-profile">${u.Profile?.Name || ''}</span></div>`).join('');
    userFilterIndex = -1;
}

function selectUser(value, label) {
    userFilter.value = value || '';
    userFilterSearch.value = value ? label : '';
    userFilterOptions.classList.remove('show');
}

function initUserSearch() {
    if (userSearchInitialized) return;
    userSearchInitialized = true;
    userFilterSearch.addEventListener('input', () => {
        renderUserOptions(userFilterSearch.value);
        userFilterOptions.classList.add('show');
        userFilterIndex = -1;
    });

    userFilterSearch.addEventListener('focus', () => {
        if (users.length) {
            renderUserOptions(userFilterSearch.value);
            userFilterOptions.classList.add('show');
        }
    });

    userFilterOptions.addEventListener('mousedown', e => {
        const opt = e.target.closest('.opt');
        if (!opt) return;
        selectUser(opt.dataset.value, opt.textContent);
    });

    userFilterOptions.addEventListener('mouseover', e => {
        const opt = e.target.closest('.opt');
        if (!opt) return;
        userFilterOptions.querySelectorAll('.opt').forEach(o => o.classList.remove('highlight'));
        opt.classList.add('highlight');
    });

    userFilterSearch.addEventListener('keydown', e => {
        const opts = userFilterOptions.querySelectorAll('.opt');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            userFilterIndex = Math.min(userFilterIndex + 1, opts.length - 1);
            opts.forEach((o, i) => o.classList.toggle('highlight', i === userFilterIndex));
            if (opts[userFilterIndex]) opts[userFilterIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            userFilterIndex = Math.max(userFilterIndex - 1, 0);
            opts.forEach((o, i) => o.classList.toggle('highlight', i === userFilterIndex));
            if (opts[userFilterIndex]) opts[userFilterIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (opts[userFilterIndex]) {
                selectUser(opts[userFilterIndex].dataset.value, opts[userFilterIndex].textContent);
            }
        } else if (e.key === 'Escape') {
            userFilterOptions.classList.remove('show');
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('#userFilterContainer')) {
            userFilterOptions.classList.remove('show');
        }
    });
}

async function loadUsers() {
    if (!salesforceAPI) return;
    try {
        users = await salesforceAPI.getUsers();
        renderUserOptions('');
        initUserSearch();
    } catch (error) {
        console.error('Error loading users:', error);
        if (isSessionExpired(error)) handleSessionExpiry();
    }
}

function showLoading(show) {
    loadingIndicator.classList.toggle('show', show);
    if (show) auditLogBody.innerHTML = '';
}

function showNoResults() {
    noResults.classList.add('show');
}

function hideNoResults() {
    noResults.classList.remove('show');
}

function isSessionExpired(error) {
    return error?.status === 401 || error?.code === 'INVALID_SESSION_ID';
}

function updateConnectionStatus(connected, instanceUrl) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (connected) {
        dot.style.background = 'var(--success)';
        text.textContent = 'Connected';
        orgUrl.textContent = instanceUrl || '';
    } else {
        dot.style.background = 'var(--text-muted)';
        text.textContent = 'Disconnected';
        orgUrl.textContent = 'Disconnected';
    }
}

function handleSessionExpiry(instanceUrl) {
    salesforceAPI = null;
    chrome.storage.local.remove(['instanceUrl', 'accessToken', 'authMethod']);
    updateConnectionStatus(false);
    disconnectedMsg.style.display = 'block';
    document.getElementById('connectedContent').style.display = 'none';
}

async function getSalesforceAuth(instanceUrl) {
    try {
        const url = new URL(instanceUrl);
        const hostname = url.hostname;
        const parts = hostname.split('.');
        const domains = [hostname, '.' + hostname];
        for (let i = 1; i < parts.length; i++) {
            domains.push('.' + parts.slice(i).join('.'));
        }
        for (const domain of domains) {
            const cookies = await chrome.cookies.getAll({ domain });
            const sidCookie = cookies.find(c => c.name === 'sid') || cookies.find(c => c.name.startsWith('sid_'));
            if (sidCookie) return { accessToken: sidCookie.value, method: 'cookie' };
        }
    } catch (e) {}
    return null;
}

function setupEventListeners() {
    applyFiltersBtn.addEventListener('click', () => { currentPage = 1; renderCurrentView(); });
    resetFiltersBtn.addEventListener('click', resetAllFilters);
    exportCSVBtn.addEventListener('click', exportToCSV);
    refreshBtn.addEventListener('click', () => loadEvents());

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyPreset(btn.dataset.preset);
        });
    });

    document.querySelectorAll('.inv-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            activeView = view;
            const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
            if (navItem) navItem.classList.add('active');
            currentPage = 1;
            renderCurrentView();
        });
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            const view = item.dataset.view;
            activeView = view;
            const tab = document.querySelector(`.inv-tab[data-view="${view}"]`);
            if (tab) tab.classList.add('active');
            currentPage = 1;
            renderCurrentView();
        });
    });

    document.querySelectorAll('.sec-card').forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filter;
            applyCardFilter(filter);
        });
    });

    panelClose.addEventListener('click', () => sidePanel.classList.remove('open'));

    prevPage.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderCurrentView(); }
    });
    nextPage.addEventListener('click', () => {
        const total = applyClientFilters(allRecords).length;
        if (currentPage * RECORDS_PER_PAGE < total) { currentPage++; renderCurrentView(); }
    });

    // Saved Views
    document.getElementById('saveViewBtn').addEventListener('click', async () => {
        const name = prompt('Enter a name for this view:');
        if (name && name.trim()) {
            const ok = await saveCurrentView(name.trim());
            if (ok) {
                await populateSavedViews();
            } else {
                alert('Failed to save view');
            }
        }
    });

    document.getElementById('loadViewSelect').addEventListener('change', async (e) => {
        const name = e.target.value;
        if (name) {
            await loadSavedView(name);
            e.target.value = '';
        }
    });
}

function setupStaticEventListeners() {
    reconnectBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const aiHeader = document.getElementById('aiHeader');
    if (aiHeader) {
        aiHeader.addEventListener('click', () => {
            const panel = document.getElementById('aiPanel');
            panel.classList.toggle('collapsed');
            chrome.storage.local.set({ aiPanelCollapsed: panel.classList.contains('collapsed') });
        });
        // Restore collapsed state
        chrome.storage.local.get(['aiPanelCollapsed'], (data) => {
            if (data.aiPanelCollapsed) document.getElementById('aiPanel').classList.add('collapsed');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') sidePanel.classList.remove('open');

        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const views = ['timeline', 'by-user', 'by-object', 'by-permission', 'by-deployment'];
            const num = parseInt(e.key);
            if (num >= 1 && num <= 5) {
                e.preventDefault();
                const view = views[num - 1];
                if (view && document.querySelector(`[data-view="${view}"]`)) {
                    document.querySelectorAll('.inv-tab, .nav-item').forEach(el => el.classList.remove('active'));
                    activeView = view;
                    document.querySelector(`.inv-tab[data-view="${view}"]`)?.classList.add('active');
                    document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
                    currentPage = 1;
                    renderCurrentView();
                }
            }
        }

        if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
            if (!e.target.closest('input, textarea, select')) {
                e.preventDefault();
                loadEvents();
            }
        }

        if ((e.key === 'f' && (e.ctrlKey || e.metaKey))) {
            if (!e.target.closest('input, textarea')) {
                e.preventDefault();
                searchFilter.focus();
            }
        }

        if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
            if (!e.target.closest('input, textarea, select')) {
                e.preventDefault();
                noiseFilter.checked = !noiseFilter.checked;
                currentPage = 1;
                renderCurrentView();
            }
        }
    });
}

async function loadTheme() {
    try {
        const { theme } = await chrome.storage.local.get(['theme']);
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            updateThemeIcons(true);
        }
    } catch (e) {}
}

function updateThemeIcons(isDark) {
    const sun = document.querySelector('.sun-icon');
    const moon = document.querySelector('.moon-icon');
    if (sun && moon) {
        sun.style.display = isDark ? 'none' : 'block';
        moon.style.display = isDark ? 'block' : 'none';
    }
}

async function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcons(!isDark);
    try {
        await chrome.storage.local.set({ theme: newTheme });
    } catch (e) {}
}

function applyPreset(preset) {
    activePreset = preset;
    resetFilterValues();

    switch (preset) {
        case 'security-review':
            severityFilter.value = '';
            // Show last 7 days
            const d7 = new Date(); d7.setDate(d7.getDate() - 7);
            startDate.value = toDateStr(d7);
            endDate.value = toDateStr(new Date());
            break;
        case 'deployment-audit':
            typeFilter.value = 'create';
            noiseFilter.checked = true;
            const d30 = new Date(); d30.setDate(d30.getDate() - 30);
            startDate.value = toDateStr(d30);
            endDate.value = toDateStr(new Date());
            activeView = 'by-deployment';
            break;
        case 'user-investigation':
            severityFilter.value = 'critical';
            noiseFilter.checked = true;
            const d14 = new Date(); d14.setDate(d14.getDate() - 14);
            startDate.value = toDateStr(d14);
            endDate.value = toDateStr(new Date());
            activeView = 'by-user';
            break;
        case 'compliance-audit':
            severityFilter.value = '';
            noiseFilter.checked = false;
            const d90 = new Date(); d90.setDate(d90.getDate() - 90);
            startDate.value = toDateStr(d90);
            endDate.value = toDateStr(new Date());
            break;
    }

    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.inv-tab[data-view="${activeView}"]`);
    if (tab) tab.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector(`.nav-item[data-view="${activeView}"]`);
    if (nav) nav.classList.add('active');

    currentPage = 1;
    renderCurrentView();
}

function applyCardFilter(filter) {
    resetFilterValues();
    switch (filter) {
        case 'critical': severityFilter.value = 'critical'; break;
        case 'failed-logins': searchFilter.value = 'Login'; startDate.value = toDateStr(new Date(new Date() - 86400000 * 7)); break;
        case 'permission': categoryFilter.value = 'permission'; break;
        case 'deployment': typeFilter.value = 'create'; break;
        case 'api': searchFilter.value = 'API'; break;
        case 'sharing': searchFilter.value = 'sharing'; break;
    }
    currentPage = 1;
    renderCurrentView();
}

function resetFilterValues() {
    severityFilter.value = '';
    categoryFilter.value = '';
    typeFilter.value = '';
    userFilter.value = '';
    userFilterSearch.value = '';
    searchFilter.value = '';
    startDate.value = '';
    endDate.value = '';
    noiseFilter.checked = true;
    activeView = 'timeline';
}

function resetAllFilters() {
    resetFilterValues();
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.preset-btn[data-preset="security-review"]')?.classList.add('active');
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.inv-tab[data-view="timeline"]')?.classList.add('active');
    activeView = 'timeline';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="timeline"]')?.classList.add('active');
    currentPage = 1;
    renderCurrentView();
}

function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Investigation mode drill-down functions (called from HTML onclick)
function invByUser(name) {
    searchFilter.value = name;
    activeView = 'timeline';
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.inv-tab[data-view="timeline"]')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="timeline"]')?.classList.add('active');
    currentPage = 1;
    renderCurrentView();

    sidePanel.classList.add('open');
    panelTitle.textContent = `User: ${name}`;
    const records = applyClientFilters(allRecords).filter(r => r.CreatedBy?.Name === name);

    // Calculate trust score
    const criticalCount = records.filter(r => r._severity === 'critical').length;
    const warningCount = records.filter(r => r._severity === 'warning').length;
    const failedCount = records.filter(r => (r.Status || '').toLowerCase() === 'failure').length;
    const permChangeCount = records.filter(r => r._class.category === 'permission').length;
    const loginAsCount = records.filter(r =>
        (r.Action || '').toLowerCase().includes('suorgadminlogin') ||
        (r.Action || '').toLowerCase().includes('suloginaccessused')
    ).length;

    let trustScore = 100;
    trustScore -= criticalCount * 5;
    trustScore -= warningCount * 2;
    trustScore -= failedCount * 3;
    trustScore -= permChangeCount * 1;
    trustScore -= loginAsCount * 10;
    trustScore = Math.max(0, Math.min(100, trustScore));

    const trustColor = trustScore >= 80 ? 'var(--success)' : trustScore >= 50 ? 'var(--warning)' : 'var(--critical)';

    // Activity by day
    const dayCounts = [0,0,0,0,0,0,0];
    records.forEach(r => {
        const d = new Date(r.CreatedDate);
        dayCounts[d.getDay()]++;
    });
    const maxDay = Math.max(...dayCounts, 1);
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const activityBars = dayNames.map((n, i) =>
        `<div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <span style="width:22px;color:var(--text-muted);">${n}</span>
            <div style="flex:1;height:12px;background:var(--bg);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${(dayCounts[i]/maxDay*100)}%;background:${trustColor};border-radius:3px;transition:width 0.3s;"></div>
            </div>
            <span style="width:24px;text-align:right;color:var(--text-muted);font-weight:600;">${dayCounts[i]}</span>
        </div>`
    ).join('');

    // Risk factors
    const riskFactors = [];
    if (criticalCount > 5) riskFactors.push(`High critical event count (${criticalCount})`);
    if (loginAsCount > 0) riskFactors.push(`Login-As activity (${loginAsCount} events)`);
    if (failedCount > 3) riskFactors.push(`Multiple failed operations (${failedCount})`);
    if (permChangeCount > 10) riskFactors.push(`Extensive permission changes (${permChangeCount})`);
    if (records.some(r => r.DelegateUser)) riskFactors.push('Impersonated sessions detected');
    if (records.some(r => r.Action === 'PermSetEnableUserPerm')) riskFactors.push('Enabled elevated user permissions');

    // User info from records
    const sample = records.find(r => r.CreatedBy?.Name === name);
    const userInfo = sample?.CreatedBy || {};

    panelBody.innerHTML = `
    <div class="panel-section">
        <h4>Trust Score</h4>
        <div style="display:flex;align-items:center;gap:16px;padding:12px;background:var(--bg);border-radius:var(--radius);margin-bottom:12px;">
            <div style="width:64px;height:64px;border-radius:50%;background:conic-gradient(${trustColor} ${trustScore}%, var(--border) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <div style="width:52px;height:52px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:${trustColor};">${trustScore}</div>
            </div>
            <div>
                <div style="font-size:14px;font-weight:600;color:${trustColor};">${trustScore >= 80 ? 'Trusted' : trustScore >= 50 ? 'Needs Review' : 'High Risk'}</div>
                <div style="font-size:12px;color:var(--text-muted);">Based on ${records.length} events</div>
            </div>
        </div>
    </div>

    <div class="panel-section">
        <h4>Summary</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
            <div class="detail-section"><div style="font-size:24px;font-weight:700;color:var(--critical);">${criticalCount}</div><div style="font-size:11px;color:var(--text-muted);">Critical</div></div>
            <div class="detail-section"><div style="font-size:24px;font-weight:700;color:var(--warning);">${warningCount}</div><div style="font-size:11px;color:var(--text-muted);">Warning</div></div>
            <div class="detail-section"><div style="font-size:24px;font-weight:700;color:var(--primary);">${records.length}</div><div style="font-size:11px;color:var(--text-muted);">Total Events</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--text-secondary);">
            <span>Failed: <strong style="color:var(--critical);">${failedCount}</strong></span>
            <span>Permission Changes: <strong style="color:var(--warning);">${permChangeCount}</strong></span>
            <span>Login-As: <strong style="color:var(--critical);">${loginAsCount}</strong></span>
        </div>
    </div>

    ${riskFactors.length > 0 ? `
    <div class="panel-section">
        <h4>Risk Factors</h4>
        ${riskFactors.map(rf =>
            `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:4px;background:var(--critical-bg);border-radius:4px;font-size:12px;color:var(--critical);">
                <span style="width:4px;height:4px;border-radius:50%;background:var(--critical);flex-shrink:0;"></span>
                ${rf}
            </div>`
        ).join('')}
    </div>` : ''}

    <div class="panel-section">
        <h4>Activity by Day</h4>
        <div style="display:flex;flex-direction:column;gap:3px;">${activityBars}</div>
    </div>

    <div class="panel-section">
        <h4>Recent Events</h4>
        ${records.slice(0, 10).map(r =>
            `<div class="event-card">
                <div class="row">
                    <span class="title"><span class="severity-badge ${getSeverityClass(r._severity)}" style="margin-right:6px;">${r._severity}</span>${r._humanAction}</span>
                    <span class="time">${formatDateTime(r.CreatedDate).time}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${(r.Display || '').substring(0, 100)}</div>
            </div>`
        ).join('')}
    </div>`;
}

function invByObject(obj) {
    searchFilter.value = obj;
    activeView = 'timeline';
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.inv-tab[data-view="timeline"]')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="timeline"]')?.classList.add('active');
    currentPage = 1;
    renderCurrentView();

    sidePanel.classList.add('open');
    panelTitle.textContent = `Object: ${obj}`;
    // Filter records matching this object
    const records = applyClientFilters(allRecords).filter(r => extractObjectName(r) === obj);
    panelBody.innerHTML = `<div class="panel-section">
        <h4>Changes to ${obj}</h4>
        ${records.slice(0, 20).map(r =>
            `<div class="event-card">
                <div class="row">
                    <span class="title"><span class="severity-badge ${getSeverityClass(r._severity)}" style="margin-right:6px;">${r._severity}</span>${r._humanAction}</span>
                    <span class="time">${r.CreatedBy?.Name || ''}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${(r.Display || '').substring(0, 100)}</div>
            </div>`
        ).join('')}
    </div>`;
}

function invByDeployment(date, user) {
    searchFilter.value = `${date} ${user}`;
    activeView = 'timeline';
    currentPage = 1;
    renderCurrentView();

    sidePanel.classList.add('open');
    panelTitle.textContent = `Deployment: ${date}`;
    const records = applyClientFilters(allRecords).filter(r =>
        r.CreatedDate?.startsWith(date) && r.CreatedBy?.Name === user
    );
    panelBody.innerHTML = `<div class="panel-section">
        <h4>Deployment by ${user} on ${date}</h4>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">${records.length} components deployed</div>
        ${records.map(r =>
            `<div class="event-card">
                <div class="row">
                    <span class="title">${r._humanAction}</span>
                    <span class="time">${formatDateTime(r.CreatedDate).time}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${(r.Display || '').substring(0, 100)}</div>
            </div>`
        ).join('')}
    </div>`;
}

async function exportToCSV() {
    if (!salesforceAPI) return;
    const records = applyClientFilters(allRecords);
    if (records.length === 0) { alert('No records to export'); return; }

    const headers = ['Date/Time', 'User', 'Action', 'Category', 'Severity', 'Score', 'Section', 'Details', 'Status', 'Delegate User'];
    const csvContent = [
        headers.join(','),
        ...records.map(r => [
            r.CreatedDate || '',
            r.CreatedBy?.Name || '',
            r._humanAction || '',
            r._class.category || '',
            r._severity || '',
            r._score || '',
            r.Section || '',
            (r.Display || '').replace(/"/g, '""'),
            r.Status || '',
            r.DelegateUser || ''
        ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditview_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ====== SAVED VIEWS ======
async function saveCurrentView(name) {
    const state = {
        severity: severityFilter.value,
        category: categoryFilter.value,
        type: typeFilter.value,
        userId: userFilter.value,
        search: searchFilter.value,
        startDate: startDate.value,
        endDate: endDate.value,
        hideNoise: noiseFilter.checked,
        view: activeView,
        preset: activePreset
    };
    try {
        const { savedViews = {} } = await chrome.storage.local.get(['savedViews']);
        savedViews[name] = { state, savedAt: new Date().toISOString() };
        await chrome.storage.local.set({ savedViews });
        return true;
    } catch (e) { return false; }
}

async function loadSavedView(name) {
    try {
        const { savedViews = {} } = await chrome.storage.local.get(['savedViews']);
        const view = savedViews[name];
        if (!view) return false;
        const s = view.state;
        severityFilter.value = s.severity || '';
        categoryFilter.value = s.category || '';
        typeFilter.value = s.type || '';
        userFilter.value = s.userId || '';
        userFilterSearch.value = s.userId ? '' : '';
        searchFilter.value = s.search || '';
        startDate.value = s.startDate || '';
        endDate.value = s.endDate || '';
        noiseFilter.checked = s.hideNoise !== false;
        if (s.view) {
            activeView = s.view;
            document.querySelectorAll('.inv-tab, .nav-item').forEach(el => el.classList.remove('active'));
            document.querySelector(`.inv-tab[data-view="${s.view}"]`)?.classList.add('active');
            document.querySelector(`.nav-item[data-view="${s.view}"]`)?.classList.add('active');
        }
        currentPage = 1;
        renderCurrentView();
        return true;
    } catch (e) { return false; }
}

async function getSavedViews() {
    try {
        const { savedViews = {} } = await chrome.storage.local.get(['savedViews']);
        return Object.entries(savedViews).map(([name, data]) => ({ name, ...data }));
    } catch (e) { return []; }
}

async function deleteSavedView(name) {
    try {
        const { savedViews = {} } = await chrome.storage.local.get(['savedViews']);
        delete savedViews[name];
        await chrome.storage.local.set({ savedViews });
        return true;
    } catch (e) { return false; }
}

async function populateSavedViews() {
    const select = document.getElementById('loadViewSelect');
    if (!select) return;
    const views = await getSavedViews();
    select.innerHTML = '<option value="">Saved Views</option>' +
        views.map(v => `<option value="${v.name}">${v.name} (${new Date(v.savedAt).toLocaleDateString()})</option>`).join('');
}

// ====== BLAST RADIUS ======
function calculateBlastRadius(record) {
    if (!record) return null;
    const action = (record.Action || '').toLowerCase();
    const display = record.Display || '';

    // Profile changes: estimate affected users
    if (action.includes('profile') && (action.includes('perm') || action.includes('olp') || action.includes('fls'))) {
        const profileMatch = display.match(/profile\s+(.+?)(?:\s|$|change)/i) ||
                             display.match(/for\s+(.+?)(?:\s|$|,)/i);
        const profileName = profileMatch ? profileMatch[1] : 'Unknown Profile';
        const allUserProfiles = allRecords.filter(r =>
            (r.Action === 'changedprofileforuser' || r.Action === 'changedprofileforusercusttostd') &&
            (r.Display || '').toLowerCase().includes(profileName.toLowerCase())
        );
        const affectedUsers = [...new Set(allUserProfiles.map(r => r.CreatedBy?.Name).filter(Boolean))];
        return {
            type: 'profile',
            target: profileName,
            affectedUsers: affectedUsers.length || 'Unknown',
            affectedObjects: [],
            impact: affectedUsers.length > 50 ? 'High' : affectedUsers.length > 10 ? 'Medium' : 'Low'
        };
    }

    // Permission set changes: estimate scope
    if (action.includes('permset') && (action.includes('assign') || action.includes('enable') || action.includes('disable'))) {
        const permSetMatch = display.match(/permission\s+set\s+(.+?)(?:\s|$|to)/i) ||
                             display.match(/for\s+(.+?)(?:\s|$|,)/i);
        const permSetName = permSetMatch ? permSetMatch[1] : 'Unknown Permission Set';
        const assignEvents = allRecords.filter(r =>
            (r.Action === 'PermSetAssign' || r.Action === 'PermSetGroupAssign') &&
            (r.Display || '').toLowerCase().includes(permSetName.toLowerCase())
        );
        const affectedUsers = [...new Set(assignEvents.map(r => r.CreatedBy?.Name).filter(Boolean))];
        return {
            type: 'permission-set',
            target: permSetName,
            affectedUsers: affectedUsers.length || 'Unknown',
            affectedObjects: [],
            impact: affectedUsers.length > 20 ? 'High' : affectedUsers.length > 5 ? 'Medium' : 'Low'
        };
    }

    // Login-As: direct user impact
    if (action.includes('suorgadminlogin') || action.includes('suloginaccessused')) {
        return {
            type: 'login-as',
            target: display.split(' ').slice(0, 3).join(' ') || 'Unknown User',
            affectedUsers: 1,
            affectedObjects: [],
            impact: 'High'
        };
    }

    // User activation/deactivation
    if (action === 'activateduser' || action === 'deactivateduser') {
        const targetUser = display.match(/user\s+(.+?)(?:\s|$)/i);
        return {
            type: 'user-status',
            target: targetUser ? targetUser[1] : 'Unknown User',
            affectedUsers: 1,
            affectedObjects: [],
            impact: 'Medium'
        };
    }

    return null;
}
