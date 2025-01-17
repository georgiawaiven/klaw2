import { cleanup, screen, within } from "@testing-library/react";
import { waitForElementToBeRemoved } from "@testing-library/react/pure";
import userEvent from "@testing-library/user-event";
import BrowseTopics from "src/app/features/topics/browse/BrowseTopics";
import { mockGetEnvironments } from "src/domain/environment";
import { mockedEnvironmentResponse } from "src/domain/environment/environment-api.msw";
import { mockedTeamResponse, mockGetTeams } from "src/domain/team/team-api.msw";
import {
  mockedResponseMultiplePage,
  mockedResponseSinglePage,
  mockedResponseTransformed,
  mockTopicGetRequest,
} from "src/domain/topic/topic-api.msw";
import api from "src/services/api";
import { server } from "src/services/api-mocks/server";
import { mockIntersectionObserver } from "src/services/test-utils/mock-intersection-observer";
import { customRender } from "src/services/test-utils/render-with-wrappers";
import { tabNavigateTo } from "src/services/test-utils/tabbing";
import {
  createMockTopicApiResponse,
  createMockTopic,
} from "src/domain/topic/topic-test-helper";

jest.mock("@aivenio/aquarium", () => {
  return {
    __esModule: true,
    ...jest.requireActual("@aivenio/aquarium"),
    Icon: jest.fn(),
  };
});

interface GetTopicsParams {
  pageNo?: string;
  env?: string;
  teamName?: string;
  topicnamesearch?: string;
}

interface GetUrlWithParams extends GetTopicsParams {
  route: string;
}

const getUrlWithParams = ({
  route,
  pageNo = "1",
  env = "ALL",
  teamName,
  topicnamesearch,
}: GetUrlWithParams) => {
  const params: Record<string, string> = { pageNo, env };

  if (teamName !== undefined) {
    params.teamName = teamName;
  }

  if (topicnamesearch !== undefined) {
    params.topicnamesearch = topicnamesearch;
  }

  return `/${route}?${new URLSearchParams(params)}`;
};

const filterByEnvironmentLabel = "Filter by environment";
const filterByTeamLabel = "Filter by team";
describe("BrowseTopics.tsx", () => {
  beforeAll(() => {
    server.listen();
    mockIntersectionObserver();
  });

  afterAll(() => {
    server.close();
  });

  describe("handles loading state", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });
      mockTopicGetRequest({
        mswInstance: server,
        response: { status: 200, data: mockedResponseSinglePage },
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      cleanup();
    });

    it("shows a loading message while data is being fetched", () => {
      const loading = screen.getByText("Loading...");

      expect(loading).toBeVisible();
    });
  });

  describe("handles error responses", () => {
    beforeEach(() => {
      console.error = jest.fn();
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });
      mockTopicGetRequest({
        mswInstance: server,
        response: { status: 400, data: { message: "Not relevant" } },
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      server.resetHandlers();
      cleanup();
    });

    it("shows an error message to the user", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const errorMessage = screen.getByText("Something went wrong 😔");

      expect(errorMessage).toBeVisible();
    });
  });

  describe("handles an empty response", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });
      mockTopicGetRequest({
        mswInstance: server,
        response: { status: 200, data: [] },
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      cleanup();
    });

    it("shows an info to user that no topic is found", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const emptyMessage = screen.getByText("No topics found");

      expect(emptyMessage).toBeVisible();
    });
  });

  describe("handles successful response with one page", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });
      mockTopicGetRequest({
        mswInstance: server,
        response: { status: 200, data: mockedResponseSinglePage },
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      cleanup();
    });

    it("renders a select element to filter topics by Kafka environment", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByEnvironmentLabel,
      });

      expect(select).toBeEnabled();
    });

    it("renders a select element to filter topics by team", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByTeamLabel,
      });

      expect(select).toBeEnabled();
    });

    it("renders the topic table with information about the pages", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      const table = screen.getByRole("table", {
        name: `Topics overview, page 1 of 1`,
      });

      expect(table).toBeVisible();
    });

    it("shows topic names row headers", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      const table = screen.getByRole("table", {
        name: "Topics overview, page 1 of 1",
      });

      const rowHeader = within(table).getByRole("rowheader", {
        name: mockedResponseTransformed.entries[0].topicName,
      });
      expect(rowHeader).toBeVisible();
    });

    it("does not render the pagination", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const pagination = screen.queryByRole("navigation", {
        name: /Pagination/,
      });

      expect(pagination).not.toBeInTheDocument();
    });
  });

  describe("handles successful response with 4 pages", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });
      mockTopicGetRequest({
        mswInstance: server,
        response: { data: mockedResponseMultiplePage },
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      cleanup();
    });

    it("renders the topic table with information about the pages", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const table = screen.getByRole("table", {
        name: "Topics overview, page 2 of 4",
      });

      expect(table).toBeVisible();
    });

    it("shows a pagination", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const pagination = screen.getByRole("navigation", {
        name: /Pagination/,
      });

      expect(pagination).toBeVisible();
    });

    it("shows page 2 as currently active page and the total page number", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const pagination = screen.getByRole("navigation", { name: /Pagination/ });

      expect(pagination).toHaveAccessibleName(
        "Pagination navigation, you're on page 2 of 4"
      );
    });
  });

  describe("handles user stepping through pagination", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });
      mockTopicGetRequest({
        mswInstance: server,
        response: {
          data: createMockTopicApiResponse({
            entries: 10,
            currentPage: 1,
            totalPages: 10,
          }),
        },
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      jest.clearAllMocks();
      cleanup();
    });

    it("shows page 1 as currently active page and the total page number", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      const pagination = screen.getByRole("navigation", { name: /Pagination/ });

      expect(pagination).toHaveAccessibleName(
        "Pagination navigation, you're on page 1 of 10"
      );
    });

    it("fetches new data when user clicks on next page", async () => {
      const spyGet = jest.spyOn(api, "get");
      const url = getUrlWithParams({
        route: "getTopics",
        pageNo: "2",
      });
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const pageTwoButton = screen.getByRole("button", {
        name: "Go to next page, page 2",
      });

      await userEvent.click(pageTwoButton);

      const pagination = await screen.findByRole("navigation", {
        name: "Pagination navigation, you're on page 1 of 10",
      });

      expect(spyGet).toHaveBeenCalledWith(url);
      expect(pagination).toBeVisible();
    });
  });

  describe("handles user filtering topics by environment", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });

      const topicsFilteredByTeam = [
        [
          createMockTopic({
            topicName: "Topic 1",
            topicId: 1,
            environmentsList: ["DEV"],
          }),
          createMockTopic({
            topicName: "Topic 1",
            topicId: 2,
            environmentsList: ["DEV"],
          }),
          createMockTopic({
            topicName: "Topic 1",
            topicId: 3,
            environmentsList: ["DEV"],
          }),
        ],
      ];
      mockTopicGetRequest({
        mswInstance: server,
        responses: [
          { data: mockedResponseSinglePage },
          { data: topicsFilteredByTeam },
        ],
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      jest.clearAllMocks();
      cleanup();
    });

    it("shows a select element for environments with `ALL` preselected", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByEnvironmentLabel,
      });

      expect(select).toHaveValue("ALL");
    });

    it("shows an information that the list is updated after user selected an environment", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByEnvironmentLabel,
      });
      const option = within(select).getByRole("option", {
        name: "DEV",
      });
      expect(select).toHaveValue("ALL");

      await userEvent.selectOptions(select, option);

      const updatingList = screen.getByText("Filtering list...");
      expect(updatingList).toBeVisible();
    });

    it("changes active selected option when user selects `DEV`", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByEnvironmentLabel,
      });
      const option = within(select).getByRole("option", {
        name: "DEV",
      });
      expect(select).toHaveValue("ALL");

      await userEvent.selectOptions(select, option);

      expect(select).toHaveValue("1");
    });

    it("fetches new data when user selects `DEV`", async () => {
      const spyGet = jest.spyOn(api, "get");
      const url = getUrlWithParams({
        route: "getTopics",
        env: "1",
      });
      const getAllTopics = () =>
        within(
          screen.getByRole("table", { name: /Topics overview/ })
        ).getAllByRole("rowheader");
      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      expect(getAllTopics()).toHaveLength(10);

      const select = screen.getByRole("combobox", {
        name: filterByEnvironmentLabel,
      });
      const option = within(select).getByRole("option", {
        name: "DEV",
      });

      await userEvent.selectOptions(select, option);
      await waitForElementToBeRemoved(screen.getByText("Filtering list..."));

      expect(spyGet).toHaveBeenCalledWith(url);
      expect(getAllTopics()).toHaveLength(3);
    });
  });

  describe("handles user filtering topics by team", () => {
    beforeEach(() => {
      mockGetEnvironments({
        mswInstance: server,
        response: { data: mockedEnvironmentResponse },
      });
      mockGetTeams({
        mswInstance: server,
        response: { data: mockedTeamResponse },
      });

      const responseWithTeamFilter = [
        [
          createMockTopic({
            topicName: "Topic 1",
            topicId: 1,
            environmentsList: ["DEV"],
          }),
          createMockTopic({
            topicName: "Topic 2",
            topicId: 2,
            environmentsList: ["DEV"],
          }),
        ],
      ];
      mockTopicGetRequest({
        mswInstance: server,
        responses: [
          { data: mockedResponseSinglePage },
          { data: responseWithTeamFilter },
        ],
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      jest.clearAllMocks();
      cleanup();
    });

    it("shows a select element for team with `All teams` preselected", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByTeamLabel,
      });

      expect(select).toHaveValue("f5ed03b4-c0da-4b18-a534-c7e9a13d1342");
    });

    it("changes active selected option when user selects `TEST_TEAM_02`", async () => {
      await waitForElementToBeRemoved(screen.getByText("Loading..."));
      const select = screen.getByRole("combobox", {
        name: filterByTeamLabel,
      });
      const option = within(select).getByRole("option", {
        name: "TEST_TEAM_02",
      });
      expect(select).toHaveValue("f5ed03b4-c0da-4b18-a534-c7e9a13d1342");

      await userEvent.selectOptions(select, option);

      expect(select).toHaveValue("TEST_TEAM_02");
    });

    it("fetches new data when user selects `TEST_TEAM_02`", async () => {
      const spyGet = jest.spyOn(api, "get");
      const url = getUrlWithParams({
        route: "getTopics",
        teamName: "TEST_TEAM_02",
      });
      const getAllTopics = () =>
        within(
          screen.getByRole("table", { name: /Topics overview/ })
        ).getAllByRole("rowheader");
      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      expect(getAllTopics()).toHaveLength(10);

      const select = screen.getByRole("combobox", {
        name: filterByTeamLabel,
      });
      const option = within(select).getByRole("option", {
        name: "TEST_TEAM_02",
      });

      await userEvent.selectOptions(select, option);
      await waitForElementToBeRemoved(screen.getByText("Filtering list..."));
      expect(spyGet).toHaveBeenCalledWith(url);
      expect(getAllTopics()).toHaveLength(2);
    });
  });

  describe("handles user searching by topic name with search input", () => {
    const testSearchInput = "Searched for topic";
    const getAllTopics = () =>
      within(
        screen.getByRole("table", { name: /Topics overview/ })
      ).getAllByRole("rowheader");

    beforeEach(() => {
      mockTopicGetRequest({
        mswInstance: server,
        responses: [
          { data: mockedResponseSinglePage },
          {
            data: [
              [
                {
                  ...createMockTopic({
                    topicName: "Topic 1",
                    topicId: 1,
                  }),
                  teamname: "TEST_TEAM_02",
                },
                {
                  ...createMockTopic({
                    topicName: "Topic 2",
                    topicId: 2,
                  }),
                  teamname: "TEST_TEAM_02",
                },
              ],
            ],
          },
        ],
      });
      customRender(<BrowseTopics />, { memoryRouter: true, queryClient: true });
    });

    afterEach(() => {
      server.resetHandlers();
      jest.clearAllMocks();
      cleanup();
    });

    it("fetches new data when user enters text in input and clicks the search button", async () => {
      const spyGet = jest.spyOn(api, "get");
      const url = getUrlWithParams({
        route: "getTopics",
        topicnamesearch: testSearchInput,
      });
      const input = screen.getByRole("searchbox", {
        name: "Search by topic name",
      });
      const submitButton = screen.getByRole("button", {
        name: "Submit search",
      });

      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      expect(getAllTopics()).toHaveLength(10);
      expect(input).toHaveValue("");
      expect(submitButton).toBeEnabled();

      await userEvent.type(input, testSearchInput);

      expect(input).toHaveValue(testSearchInput);

      await userEvent.click(submitButton);
      await waitForElementToBeRemoved(screen.getByText("Filtering list..."));

      expect(spyGet).toHaveBeenCalledWith(url);
      expect(getAllTopics()).toHaveLength(2);
    });

    it("fetches new data when when user enters text in input and presses 'Enter'", async () => {
      const spyGet = jest.spyOn(api, "get");
      const url = getUrlWithParams({
        route: "getTopics",
        topicnamesearch: testSearchInput,
      });
      const input = screen.getByRole("searchbox", {
        name: "Search by topic name",
      });

      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      expect(getAllTopics()).toHaveLength(10);
      expect(input).toHaveValue("");

      await userEvent.type(input, testSearchInput);

      expect(input).toHaveValue(testSearchInput);

      await userEvent.keyboard("{Enter}");
      await waitForElementToBeRemoved(screen.getByText("Filtering list..."));

      expect(spyGet).toHaveBeenCalledWith(url);
      expect(getAllTopics()).toHaveLength(2);
    });

    it("can navigate to search input and submit button with keyboard", async () => {
      const input = screen.getByRole("searchbox", {
        name: "Search by topic name",
      });
      const submitButton = screen.getByRole("button", {
        name: "Submit search",
      });

      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      expect(getAllTopics()).toHaveLength(10);
      expect(input).toHaveValue("");
      expect(submitButton).toBeEnabled();

      await tabNavigateTo({ targetElement: input });

      expect(input).toHaveFocus();

      await userEvent.tab();

      expect(submitButton).toHaveFocus();
    });

    it("fetches new data when user enters text in input and presses 'Enter' on focused submit button", async () => {
      const spyGet = jest.spyOn(api, "get");
      const url = getUrlWithParams({
        route: "getTopics",
        topicnamesearch: testSearchInput,
      });
      const input = screen.getByRole("searchbox", {
        name: "Search by topic name",
      });
      const submitButton = screen.getByRole("button", {
        name: "Submit search",
      });

      await waitForElementToBeRemoved(screen.getByText("Loading..."));

      expect(getAllTopics()).toHaveLength(10);
      expect(input).toHaveValue("");
      expect(submitButton).toBeEnabled();

      await tabNavigateTo({ targetElement: input });

      expect(input).toHaveFocus();

      await userEvent.type(input, testSearchInput);

      expect(input).toHaveValue(testSearchInput);

      await userEvent.tab();

      expect(submitButton).toHaveFocus();

      await userEvent.keyboard("{Enter}");
      await waitForElementToBeRemoved(screen.getByText("Filtering list..."));

      expect(spyGet).toHaveBeenCalledWith(url);
      expect(getAllTopics()).toHaveLength(2);
    });
  });
});
