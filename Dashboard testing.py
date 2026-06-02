import os
import time
import datetime
import requests
import pandas as pd
import re
import html


from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE

# Configuration
API = "https://api.workspan.com"
CLIENT_ID = "WS-ApplicationUser_ag5zfndvcmtzcGFuLWFwcHIZCxIPQXBwbGljYXRpb25Vc2VyGL-q_a85DA"
CLIENT_SECRET = "1c0016f6f17144a797ccb28f5ddcaba7"

ONEDRIVE_DIRECTORY = r"C:\Users\makhayat\OneDrive - Cisco\Documents - CX Partner Success TEAM\PCSS Team\Dashboards and Reporting Metrics\Adoption Dashboard"

LOG_FILE_PATH = r"C:\Users\makhayat\OneDrive - Cisco\Documents\Adoption dashboard excel\data_file_log.txt"

# Report Mapping: (Report ID, Output Filename, Report Type, Folder)
REPORTS_TO_PROCESS = [
    (21732, "CPI_data_testing.csv", "partner", "LCI data EMEA"),
]

# Column order for Partner reports
COLUMN_ORDER_PARTNER = [
    "Deal WS-ID", "Partner Name", "BE GEO ID", "Partner Country", "Partner Region",
    "CR Party Name", "CR Party ID", "Program Type", "Track", "Sub-Track",
    "Incentive Level", "Deal Incentive Expiry Date", "Booking Date",
    "Booking Amount - Net to Cisco", "Booking Amount - Net to Cisco (Currency)",
    "Stage", "Adopt Rebate Opt-In Status", "Adopt Rebate Start Date",
    "Stage Completion Flag (Purchase)", "Stage Completion Date (Purchase)",
    "Stage Completion Flag(onboard)", "Stage Completion Date(onboard)",
    "Stage Completion Flag (Implement)", "Stage Completion Date (Implement)",
    "Stage Completion Flag(Use)", "Stage Completion Date(Use)",
    "Stage Completion Flag(Engage)", "Stage Completion Date(Engage)",
    "Stage Completion Flag(Adopt)", "Stage Completion Date(Adopt)",
    "Estimated Incentive Amount(Onboard)", "Estimated Incentive Amount(Onboard) (Currency)",
    "Estimated Incentive Amount(Use)", "Estimated Incentive Amount(Use) (Currency)",
    "Estimated Incentive Amount(Engage)", "Estimated Incentive Amount(Engage) (Currency)",
    "Estimated Incentive Amount(Adopt)", "Estimated Incentive Amount(Adopt) (Currency)",
    "Revised Maximum Incentive Amount", "Revised Maximum Incentive Amount (Currency)",
    "Task Details (Purchase)", "Task Details (Onboard)", "Task Details (Implement)",
    "Task Details (Use)", "Task Details (Engage)", "Task Details (Adopt)",
    "Maximum Incentive Deal Flag", "EA Flag", "Deal ID", "Deal CPI Portfolio",
    "CX Customer BU ID",
]

# Column order for Disti reports
COLUMN_ORDER_DISTI = [
    "Deal WS-ID", "Disti Name", "BE GEO ID", "End Customer Country", "Disti Region",
    "CR Party Name", "CR Party ID", "Program Type", "Track", "Sub-Track",
    "Incentive Level", "Deal Incentive Expiry Date", "Booking Date",
    "Booking Amount - Net to Cisco", "Booking Amount - Net to Cisco (Currency)",
    "Stage", "Adopt Rebate Opt-In Status", "Adopt Rebate Start Date",
    "Stage Completion Flag (Purchase)", "Stage Completion Date (Purchase)",
    "Stage Completion Flag(onboard)", "Stage Completion Date(onboard)",
    "Stage Completion Flag (Implement)", "Stage Completion Date (Implement)",
    "Stage Completion Flag(Use)", "Stage Completion Date(Use)",
    "Stage Completion Flag(Engage)", "Stage Completion Date(Engage)",
    "Stage Completion Flag(Adopt)", "Stage Completion Date(Adopt)",
    "Estimated Incentive Amount(Onboard)", "Estimated Incentive Amount(Onboard) (Currency)",
    "Estimated Incentive Amount(Use)", "Estimated Incentive Amount(Use) (Currency)",
    "Estimated Incentive Amount(Engage)", "Estimated Incentive Amount(Engage) (Currency)",
    "Estimated Incentive Amount(Adopt)", "Estimated Incentive Amount(Adopt) (Currency)",
    "Revised Maximum Incentive Amount", "Revised Maximum Incentive Amount (Currency)",
    "Task Details (Purchase)", "Task Details (Onboard)", "Task Details (Implement)",
    "Task Details (Use)", "Task Details (Engage)", "Task Details (Adopt)",
    "Maximum Incentive Deal Flag", "EA Flag", "Deal ID", "Deal CPI Portfolio",
    "CX Customer BU ID", "Plan Name", "Cisco Relationship","2T Partner Name - (Disti Only)", "2T Partner BE GEO ID - (Disti Only)",
]


def log_file_info(log_path, report_id, filename, full_path):
    """Appends a tab-separated entry (Date, ID, Filename, Size) to the log file."""
    try:
        # Get file size in MB
        file_size_mb = os.path.getsize(full_path) / (1024 * 1024)

        # Format timestamp as dd-MM-yyyy HH:mm:ss
        timestamp = datetime.datetime.now().strftime("%d-%m-%Y %H:%M:%S")

        # Create tab-separated entry: Timestamp [TAB] ID [TAB] Filename [TAB] Size
        log_entry = f"{timestamp}\t{report_id}\t{filename}\t{file_size_mb:.2f} MB\n"

        # Append to the log file
        with open(log_path, "a") as f:
            f.write(log_entry)
        print(f"    > Log entry created for {filename}")
    except Exception as e:
        print(f"    > Warning: Failed to write to log file: {e}")


def clean_html_content(text):
    """Force-cleans HTML tags, nested entities, and special whitespace."""
    if not isinstance(text, str) or not text:
        return text

    # 1. Specific fix for &emsp and &nbsp (handles cases where semicolon is missing)
    text = re.sub(r'&emsp;?|&nbsp;?', ' ', text, flags=re.IGNORECASE)

    # 2. Unescape multiple times to handle nested encoding (e.g., &amp;lt;p&amp;gt;)
    # This turns &lt;p&gt; into <p> so the regex can see it.
    for _ in range(3):
        text = html.unescape(text)

    # 3. Replace block-level tags with a space to prevent words from sticking together
    # (e.g., "Hello<p>World" becomes "Hello World" instead of "HelloWorld")
    text = re.sub(r'<(p|br|div|li|tr)[^>]*>', ' ', text, flags=re.IGNORECASE)

    # 4. Strip all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # 5. Clean up special Unicode spaces that Excel/openpyxl often choke on
    # \xa0 is non-breaking space, \u2003 is em-space, \u2002 is en-space
    text = text.replace('\xa0', ' ').replace('\u2003', ' ').replace('\u2002', ' ')

    # 6. Replace the "mangled" question marks or illegal characters often found in names
    # This addresses the "SAMSUNG" error by removing non-standard characters
    text = text.replace('?', '')

    # 7. Collapse multiple spaces into one single space
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def remove_illegal_characters(df):
    """Removes characters that would crash the Excel engine or are invalid in Excel cells."""
    total_cols = len(df.columns)
    for i, col in enumerate(df.columns):
        if df[col].dtype == object:
            if i % 15 == 0:
                print(f"    > Validating characters in column {i + 1}/{total_cols}...")

            # Remove illegal control characters
            df[col] = df[col].apply(
                lambda x: ILLEGAL_CHARACTERS_RE.sub('', str(x)) if isinstance(x, str) else x
            )

            # Aggressive cleanup: remove non-printable characters and specific Excel-breaking symbols
            if df[col].dtype == object:
                df[col] = df[col].apply(
                    lambda x: "".join(c for c in str(x) if c.isprintable()) if isinstance(x, str) else x
                )
    return df


def clean_column_names(df):
    rename_map = {}
    for col in df.columns:
        if col.lower().endswith(".value"):
            rename_map[col] = col[: -len(".value")]
        elif col.lower().endswith(".currency"):
            rename_map[col] = col[: -len(".currency")] + " (Currency)"
    all_new_names = [rename_map.get(c, c) for c in df.columns]
    seen = {}
    for old, new in zip(df.columns, all_new_names):
        if new in seen:
            rename_map.pop(old, None)
        else:
            seen[new] = old
    return df.rename(columns=rename_map)


def unwrap_list_values(df):
    """
    Converts list objects to clean strings (joined by a space) and
    removes brackets/apostrophes from stringified lists.
    """
    for col in df.columns:
        # This joins items with a single space:
        df[col] = df[col].apply(
            lambda x: " ".join(map(str, x)) if isinstance(x, list) else x
        )

        # 2. Handle cases where the data is a string but looks like a list: "['A', 'B']"
        if df[col].dtype == object:
            df[col] = df[col].apply(
                lambda x: re.sub(r"[\[\]'\"']", "", str(x)) if isinstance(x, str) and ("[" in x or "'" in x) else x
            )

    return df


def reorder_columns(df, desired_order):
    """
    Ensures all columns in desired_order exist in the DataFrame.
    If a column is missing from the API response, it is created as empty.
    Extra columns not in desired_order are appended to the end.
    """
    # Identify any columns present in the data that are NOT in our predefined list
    extra_cols = [c for c in df.columns if c not in desired_order]

    # Combine the lists: desired columns first, then any unexpected extra columns
    full_column_list = desired_order + extra_cols

    # reindex creates missing columns with NaN values and sets the order
    return df.reindex(columns=full_column_list)


class WorkSpanExportAPI:
    headers = {"x-ws-env": "app.workspan.com"}

    def connect(self):
        print("Authenticating with WorkSpan...")
        resp = requests.post(
            f"{API}/oauth/token",
            json={"grant_type": "client_credentials", "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
            headers=self.headers,
        ).json()
        self.headers["Authorization"] = f"{resp['token_type']} {resp['access_token']}"
        print("Authenticated successfully.\n")

    def create_view(self, report_id):
        resp = requests.post(
            f"{API}/report/v1/view/{report_id}/prepare_export",
            json={"expiryHours": 1},
            headers=self.headers,
        ).json()
        view_id = resp["viewId"]
        print(f"  View {view_id} created. Waiting for server to prepare data...")

        timeout = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
        while datetime.datetime.now(datetime.timezone.utc) < timeout:
            time.sleep(15)
            status_resp = requests.get(
                f"{API}/report/v1/view/{view_id}/status", headers=self.headers
            ).json()
            status = status_resp["viewStatus"]
            print(f"  Status check: {status}")
            if status in ("PENDING", "RUNNING"):
                continue
            if status == "SUCCESS":
                return requests.get(f"{API}/report/v1/view/{view_id}", headers=self.headers).json()
            raise Exception(f"Report view creation failed with status: {status}")
        raise Exception("Report view creation timed out.")

    def get_view_data(self, view_id):
        url = f"{API}/report/v1/view/{view_id}/data"
        page, view_data = 0, []
        while True:
            resp = requests.post(url, json={"page": {"number": page, "size": 10000}}, headers=self.headers).json()
            view_data += resp["results"]
            print(f"  Fetched Page {page}: {len(resp['results'])} rows (Total so far: {len(view_data)})")
            if resp["endOfList"]:
                break
            page += 1
        return view_data



if __name__ == "__main__":
    start_all = time.time()
    ws = WorkSpanExportAPI()
    ws.connect()

    # Get the ISO year and week number for the suffix
    iso_year, iso_week, _ = datetime.datetime.now().isocalendar()
    date_suffix = f"{iso_year}W{iso_week:02d}"

    # date_suffix = datetime.datetime.now().strftime("%Y%m%d")

    # Added report_type to the unpacking
    for report_id, original_filename, report_type, data_folder in REPORTS_TO_PROCESS:
        name_part, extension = original_filename.rsplit('.', 1)
        suffixed_filename = f"{name_part}_{date_suffix}.{extension}"

        # 2. Define the full paths
        # Downloads gets the suffixed name
        #local_path = os.path.join(LOCAL_DIRECTORY, suffixed_filename)
        # OneDrive gets the original name (no suffix)
        onedrive_path = os.path.join(ONEDRIVE_DIRECTORY, data_folder, suffixed_filename)


        print(f"=== Processing Report: {report_id} ===")

        try:
            # 1. Fetch Data
            view = ws.create_view(report_id)
            view_data = ws.get_view_data(view["id"])
            #view_data = ws.get_view_data(8262)

            # 2. Build and Clean DataFrame
            print(f"  Processing {len(view_data)} rows...")
            df = pd.json_normalize(view_data, max_level=1)
            df = clean_column_names(df)
            df = unwrap_list_values(df)

            # Logic to select the correct column order based on report_type
            if report_type == "partner":
                current_column_order = COLUMN_ORDER_PARTNER
            else:
                current_column_order = COLUMN_ORDER_DISTI

            # Pass the selected list to the reorder function
            df = reorder_columns(df, current_column_order)


            # 3. Clean HTML content
            print("  Removing HTML tags and cleaning text...")
            # We apply it to every column, the function itself checks if the cell is a string
            df = df.map(clean_html_content)

            # 4. Remove Illegal Characters
            print("  Validating Excel compatibility...")
            df = remove_illegal_characters(df)

            # 5. Remove specific columns
            cols_to_drop = ['linked_object_id', 'object_id']
            df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])

            # 5.5 Sort Data by BE GEO ID
            sort_col = "BE GEO ID"
            if sort_col in df.columns:
                print(f"  Sorting data by {sort_col}...")
                # Sorts alphabetically/numerically and puts empty rows at the bottom
                df = df.sort_values(by=sort_col, ascending=True, na_position='last')
            else:
                print(f"  Warning: '{sort_col}' not found. Skipping sort.")

            # 6. Save to Excel (CPU Intensive)
            print(f"  Saving suffixed file to local folder: {suffixed_filename}")
            # df.to_excel(onedrive_path, index=False, engine="openpyxl")
            df.to_csv(onedrive_path, index=False)

            # 7. Log the results using the new function
            log_file_info(LOG_FILE_PATH, report_id, suffixed_filename, onedrive_path)

            print(f"  Done!")
            print("-" * 40 + "\n")

        except Exception as e:
            print(f"  Error processing report {report_id}: {e}\n")

    total_duration = time.time() - start_all
    print(f"All tasks completed in {total_duration / 60:.2f} minutes.")
