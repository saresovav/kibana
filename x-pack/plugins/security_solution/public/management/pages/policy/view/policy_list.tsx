/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useCallback, useEffect, useMemo, CSSProperties, useState } from 'react';
import {
  EuiBasicTable,
  EuiText,
  EuiTitle,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTableFieldDataColumnType,
  EuiLink,
  EuiPopover,
  EuiContextMenuPanelProps,
  EuiContextMenuItem,
  EuiButtonIcon,
  EuiContextMenuPanel,
  EuiOverlayMask,
  EuiConfirmModal,
  EuiCallOut,
  EuiButton,
  EuiBetaBadge,
  EuiHorizontalRule,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n/react';
import { useDispatch } from 'react-redux';
import { useLocation, useHistory } from 'react-router-dom';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';
import { CreateStructuredSelector } from '../../../../common/store';
import * as selectors from '../store/policy_list/selectors';
import { usePolicyListSelector } from './policy_hooks';
import { PolicyListAction } from '../store/policy_list';
import { useKibana } from '../../../../../../../../src/plugins/kibana_react/public';
import { Immutable, PolicyData } from '../../../../../common/endpoint/types';
import { useNavigateByRouterEventHandler } from '../../../../common/hooks/endpoint/use_navigate_by_router_event_handler';
import { LinkToApp } from '../../../../common/components/endpoint/link_to_app';
import { ManagementPageView } from '../../../components/management_page_view';
import { PolicyEmptyState } from '../../../components/management_empty_state';
import { SpyRoute } from '../../../../common/utils/route/spy_routes';
import { FormattedDateAndTime } from '../../../../common/components/endpoint/formatted_date_time';
import { SecurityPageName } from '../../../../app/types';
import { useFormatUrl } from '../../../../common/components/link_to';
import { getPolicyDetailPath, getPoliciesPath } from '../../../common/routing';
import { useNavigateToAppEventHandler } from '../../../../common/hooks/endpoint/use_navigate_to_app_event_handler';
import { CreatePackageConfigRouteState } from '../../../../../../ingest_manager/public';
import { MANAGEMENT_APP_ID } from '../../../common/constants';

interface TableChangeCallbackArguments {
  page: { index: number; size: number };
}

interface PackageData {
  name: string;
  title: string;
  version: string;
}

const NO_WRAP_TRUNCATE_STYLE: CSSProperties = Object.freeze({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const DangerEuiContextMenuItem = styled(EuiContextMenuItem)`
  color: ${(props) => props.theme.eui.textColors.danger};
`;

// eslint-disable-next-line react/display-name
export const TableRowActions = React.memo<{ items: EuiContextMenuPanelProps['items'] }>(
  ({ items }) => {
    const [isOpen, setIsOpen] = useState(false);
    const handleCloseMenu = useCallback(() => setIsOpen(false), [setIsOpen]);
    const handleToggleMenu = useCallback(() => setIsOpen(!isOpen), [isOpen]);

    return (
      <EuiPopover
        anchorPosition="downRight"
        panelPaddingSize="none"
        data-test-subj="policyActions"
        button={
          <EuiButtonIcon
            data-test-subj="policyActionsButton"
            iconType="boxesHorizontal"
            onClick={handleToggleMenu}
            aria-label={i18n.translate('xpack.securitySolution.endpoint.policyList.actionMenu', {
              defaultMessage: 'Open',
            })}
          />
        }
        isOpen={isOpen}
        closePopover={handleCloseMenu}
        repositionOnScroll
      >
        <EuiContextMenuPanel items={items} data-test-subj="policyActionsMenu" />
      </EuiPopover>
    );
  }
);

const PolicyLink: React.FC<{ name: string; route: string; href: string }> = ({
  name,
  route,
  href,
}) => {
  const clickHandler = useNavigateByRouterEventHandler(route);
  return (
    // eslint-disable-next-line @elastic/eui/href-or-on-click
    <EuiLink
      href={href}
      onClick={clickHandler}
      data-test-subj="policyNameLink"
      style={NO_WRAP_TRUNCATE_STYLE}
    >
      {name}
    </EuiLink>
  );
};

const selector = (createStructuredSelector as CreateStructuredSelector)(selectors);
export const PolicyList = React.memo(() => {
  const { services, notifications } = useKibana();
  const history = useHistory();
  const location = useLocation();
  const { formatUrl, search } = useFormatUrl(SecurityPageName.administration);

  const [showDelete, setShowDelete] = useState<boolean>(false);
  const [policyIdToDelete, setPolicyIdToDelete] = useState<string>('');

  const dispatch = useDispatch<(action: PolicyListAction) => void>();
  const {
    selectPolicyItems: policyItems,
    selectPageIndex: pageIndex,
    selectPageSize: pageSize,
    selectTotal: totalItemCount,
    selectIsLoading: loading,
    selectApiError: apiError,
    selectIsDeleting: isDeleting,
    selectDeleteStatus: deleteStatus,
    selectAgentStatusSummary: agentStatusSummary,
    endpointPackageVersion,
  } = usePolicyListSelector(selector);

  const handleCreatePolicyClick = useNavigateToAppEventHandler<CreatePackageConfigRouteState>(
    'ingestManager',
    {
      // We redirect to Ingest's Integaration page if we can't get the package version, and
      // to the Integration Endpoint Package Add Integration if we have package information.
      // Also,
      // We pass along soem state information so that the Ingest page can change the behaviour
      // of the cancel and submit buttons and redirect the user back to endpoint policy
      path: `#/integrations${
        endpointPackageVersion ? `/endpoint-${endpointPackageVersion}/add-integration` : ''
      }`,
      state: {
        onCancelNavigateTo: [MANAGEMENT_APP_ID, { path: getPoliciesPath() }],
        onCancelUrl: formatUrl(getPoliciesPath()),
        onSaveNavigateTo: [MANAGEMENT_APP_ID, { path: getPoliciesPath() }],
      },
    }
  );

  useEffect(() => {
    if (apiError) {
      notifications.toasts.danger({
        title: apiError.error,
        body: apiError.message,
        toastLifeTimeMs: 10000,
      });
    }
  }, [apiError, dispatch, notifications.toasts]);

  // Handle showing update statuses
  useEffect(() => {
    if (deleteStatus !== undefined) {
      if (deleteStatus === true) {
        setPolicyIdToDelete('');
        setShowDelete(false);
        notifications.toasts.success({
          toastLifeTimeMs: 10000,
          title: i18n.translate('xpack.securitySolution.endpoint.policyList.deleteSuccessToast', {
            defaultMessage: 'Success!',
          }),
          body: (
            <FormattedMessage
              id="xpack.securitySolution.endpoint.policyList.deleteSuccessToastDetails"
              defaultMessage="Policy has been deleted."
            />
          ),
        });
      } else {
        notifications.toasts.danger({
          toastLifeTimeMs: 10000,
          title: i18n.translate('xpack.securitySolution.endpoint.policyList.deleteFailedToast', {
            defaultMessage: 'Failed!',
          }),
          body: i18n.translate('xpack.securitySolution.endpoint.policyList.deleteFailedToastBody', {
            defaultMessage: 'Failed to delete policy',
          }),
        });
      }
    }
  }, [notifications.toasts, deleteStatus]);

  const paginationSetup = useMemo(() => {
    return {
      pageIndex,
      pageSize,
      totalItemCount,
      pageSizeOptions: [10, 20, 50],
      hidePerPageOptions: false,
    };
  }, [pageIndex, pageSize, totalItemCount]);

  const handleTableChange = useCallback(
    ({ page: { index, size } }: TableChangeCallbackArguments) => {
      history.push(`${location.pathname}?page_index=${index}&page_size=${size}`);
    },
    [history, location.pathname]
  );

  const handleDeleteOnClick = useCallback(
    ({ policyId, agentConfigId }: { policyId: string; agentConfigId: string }) => {
      dispatch({
        type: 'userOpenedPolicyListDeleteModal',
        payload: {
          agentConfigId,
        },
      });
      setPolicyIdToDelete(policyId);
      setShowDelete(true);
    },
    [dispatch]
  );

  const handleDeleteConfirmation = useCallback(
    ({ policyId }: { policyId: string }) => {
      dispatch({
        type: 'userClickedPolicyListDeleteButton',
        payload: {
          policyId,
        },
      });
    },
    [dispatch]
  );

  const handleDeleteCancel = useCallback(() => {
    setShowDelete(false);
  }, []);

  const columns: Array<EuiTableFieldDataColumnType<Immutable<PolicyData>>> = useMemo(
    () => [
      {
        field: 'name',
        name: i18n.translate('xpack.securitySolution.endpoint.policyList.nameField', {
          defaultMessage: 'Policy Name',
        }),
        // eslint-disable-next-line react/display-name
        render: (name: string, item: Immutable<PolicyData>) => {
          const routePath = getPolicyDetailPath(item.id, search);
          const routeUrl = formatUrl(routePath);
          return (
            <EuiFlexGroup gutterSize="s" alignItems="baseline" style={{ minWidth: 0 }}>
              <EuiFlexItem grow={false} style={NO_WRAP_TRUNCATE_STYLE}>
                <PolicyLink name={name} route={routePath} href={routeUrl} />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiText color="subdued" size="xs" style={{ whiteSpace: 'nowrap' }}>
                  <FormattedMessage
                    id="xpack.securitySolution.endpoint.policyList.revision"
                    defaultMessage="rev. {revNumber}"
                    values={{ revNumber: item.revision }}
                  />
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          );
        },
      },
      {
        field: 'created_by',
        name: i18n.translate('xpack.securitySolution.endpoint.policyList.createdBy', {
          defaultMessage: 'Created By',
        }),
        truncateText: true,
      },
      {
        field: 'created_at',
        name: i18n.translate('xpack.securitySolution.endpoint.policyList.createdAt', {
          defaultMessage: 'Created Date',
        }),
        render(createdAt: string) {
          return <FormattedDateAndTime date={new Date(createdAt)} />;
        },
      },
      {
        field: 'updated_by',
        name: i18n.translate('xpack.securitySolution.endpoint.policyList.updatedBy', {
          defaultMessage: 'Last Updated By',
        }),
        truncateText: true,
      },
      {
        field: 'updated_at',
        name: i18n.translate('xpack.securitySolution.endpoint.policyList.updatedAt', {
          defaultMessage: 'Last Updated',
        }),
        render(updatedAt: string) {
          return <FormattedDateAndTime date={new Date(updatedAt)} />;
        },
      },
      {
        field: 'package',
        name: i18n.translate('xpack.securitySolution.endpoint.policyList.versionFieldLabel', {
          defaultMessage: 'Version',
        }),
        render(pkg: Immutable<PackageData>) {
          return i18n.translate('xpack.securitySolution.endpoint.policyList.versionField', {
            defaultMessage: '{title} v{version}',
            values: {
              title: pkg.title,
              version: pkg.version,
            },
          });
        },
      },
      {
        field: '',
        name: 'Actions',
        actions: [
          {
            // eslint-disable-next-line react/display-name
            render: (item: Immutable<PolicyData>) => {
              return (
                <TableRowActions
                  items={[
                    <EuiContextMenuItem icon="link" key="agentConfigLink">
                      <LinkToApp
                        data-test-subj="agentConfigLink"
                        appId="ingestManager"
                        appPath={`#/configs/${item.config_id}`}
                        href={`${services.application.getUrlForApp('ingestManager')}#/configs/${
                          item.config_id
                        }`}
                      >
                        <FormattedMessage
                          id="xpack.securitySolution.endpoint.policyList.agentConfigAction"
                          defaultMessage="View Agent Configuration"
                        />
                      </LinkToApp>
                    </EuiContextMenuItem>,
                    <DangerEuiContextMenuItem
                      data-test-subj="policyDeleteButton"
                      icon="trash"
                      key="policyDeletAction"
                      onClick={() => {
                        handleDeleteOnClick({ agentConfigId: item.config_id, policyId: item.id });
                      }}
                    >
                      <FormattedMessage
                        id="xpack.securitySolution.endpoint.policyList.policyDeleteAction"
                        defaultMessage="Delete Policy"
                      />
                    </DangerEuiContextMenuItem>,
                  ]}
                />
              );
            },
          },
        ],
      },
    ],
    [services.application, handleDeleteOnClick, formatUrl, search]
  );

  return (
    <>
      {showDelete && (
        <ConfirmDelete
          hostCount={agentStatusSummary ? agentStatusSummary.total : 0}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
          onConfirm={() => {
            handleDeleteConfirmation({ policyId: policyIdToDelete });
          }}
        />
      )}
      <ManagementPageView
        viewType="list"
        data-test-subj="policyListPage"
        headerLeft={
          <>
            <EuiFlexGroup alignItems="center">
              <EuiFlexItem grow={false}>
                <EuiTitle size="l">
                  <h1 data-test-subj="pageViewHeaderLeftTitle">
                    <FormattedMessage
                      id="xpack.securitySolution.policyList.pageTitle"
                      defaultMessage="Policies"
                    />
                  </h1>
                </EuiTitle>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBetaBadge
                  label={i18n.translate('xpack.securitySolution.endpoint.policyList.beta', {
                    defaultMessage: 'Beta',
                  })}
                />
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              <p>
                <FormattedMessage
                  id="xpack.securitySolution.policyList.pageSubTitle"
                  defaultMessage="View and configure protections"
                />
              </p>
            </EuiText>
          </>
        }
        headerRight={
          <EuiButton
            iconType="plusInCircle"
            onClick={handleCreatePolicyClick}
            data-test-subj="headerCreateNewPolicyButton"
          >
            <FormattedMessage
              id="xpack.securitySolution.endpoint.policyList.createNewButton"
              defaultMessage="Create new policy"
            />
          </EuiButton>
        }
      >
        {policyItems && policyItems.length > 0 && (
          <>
            <EuiText color="subdued" data-test-subj="policyTotalCount" size="xs">
              <FormattedMessage
                id="xpack.securitySolution.endpoint.policyList.viewTitleTotalCount"
                defaultMessage="{totalItemCount, plural, one {# Policy} other {# Policies}}"
                values={{ totalItemCount }}
              />
            </EuiText>
            <EuiHorizontalRule margin="xs" />
          </>
        )}
        {useMemo(() => {
          return (
            <>
              {policyItems && policyItems.length > 0 ? (
                <EuiBasicTable
                  items={[...policyItems]}
                  columns={columns}
                  loading={loading}
                  pagination={paginationSetup}
                  onChange={handleTableChange}
                  data-test-subj="policyTable"
                  hasActions={false}
                />
              ) : (
                <PolicyEmptyState loading={loading} onActionClick={handleCreatePolicyClick} />
              )}
            </>
          );
        }, [
          policyItems,
          loading,
          columns,
          handleCreatePolicyClick,
          handleTableChange,
          paginationSetup,
        ])}
        <SpyRoute pageName={SecurityPageName.administration} />
      </ManagementPageView>
    </>
  );
});

PolicyList.displayName = 'PolicyList';

const ConfirmDelete = React.memo<{
  hostCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>(({ hostCount, isDeleting, onCancel, onConfirm }) => {
  return (
    <EuiOverlayMask>
      <EuiConfirmModal
        data-test-subj="policyListDeleteModal"
        title={i18n.translate('xpack.securitySolution.endpoint.policyList.deleteConfirm.title', {
          defaultMessage: 'Delete policy and deploy changes',
        })}
        onCancel={onCancel}
        onConfirm={onConfirm}
        buttonColor="danger"
        confirmButtonText={
          isDeleting ? (
            <FormattedMessage
              id="xpack.securitySolution.endpoint.policyList.deleteConfirm.deletingButton"
              defaultMessage="Deleting..."
            />
          ) : (
            <FormattedMessage
              id="xpack.securitySolution.endpoint.policyList.deleteConfirm.confirmDeleteButton"
              defaultMessage="Delete Policy"
            />
          )
        }
        confirmButtonDisabled={isDeleting}
        cancelButtonText={i18n.translate(
          'xpack.securitySolution.endpoint.policyList.deleteConfirm.cancelButtonTitle',
          {
            defaultMessage: 'Cancel',
          }
        )}
      >
        {hostCount > 0 && (
          <>
            <EuiCallOut
              data-test-subj="policyListWarningCallout"
              color="danger"
              title={i18n.translate(
                'xpack.securitySolution.endpoint.policyList.deleteConfirm.warningTitle',
                {
                  defaultMessage:
                    'This action will delete Endpoint Security from {hostCount, plural, one {# host} other {# hosts}}',
                  values: { hostCount },
                }
              )}
            >
              <FormattedMessage
                id="xpack.securitySolution.endpoint.policyList.deleteConfirm.warningMessage"
                defaultMessage="Deleting this Policy will remove Endpoint Security from these hosts"
              />
            </EuiCallOut>
            <EuiSpacer size="xl" />
          </>
        )}
        <p>
          <FormattedMessage
            id="xpack.securitySolution.endpoint.policyList.deleteConfirm.message"
            defaultMessage="This action cannot be undone. Are you sure you wish to continue?"
          />
        </p>
      </EuiConfirmModal>
    </EuiOverlayMask>
  );
});

ConfirmDelete.displayName = 'ConfirmDelete';
