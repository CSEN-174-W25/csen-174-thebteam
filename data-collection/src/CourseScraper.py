import requests
from bs4 import BeautifulSoup
import pandas as pd
import re

class CourseScraper:
    def __init__(self):
        self.base = 'https://www.scu.edu/bulletin/undergraduate/'
        self.tag_map = {
            'Anthropology': 'ANTH',
            'Art  and  Art  History': 'ARTH',
            'Biology': 'BIOL',
            'Chemistry and Biochemistry': 'CHEM',
            'Child Studies': 'CHST',
            'Classics': 'CLAS',
            'Communication': 'COMM',
            'Economics': 'ECON',
            'English': 'ENGL',
            'Environmental  Studies  and  Sciences': 'ENVS',
            'Ethnic Studies': 'ETHN',
            'Gender and Sexuality Studies': 'WGST',
            'History': 'HIST',
            'Mathematics': 'MATH',
            'Computer Science': 'COEN',
            'Arabic Studies': 'ARAB',
            'Chinese Studies': 'CHIN',
            'French Studies': 'FREN',
            'German Studies': 'GERM',
            'Italian Studies': 'ITAL',
            'Japanese Studies': 'JAPN',
            'Spanish Studies': 'SPAN',
            'Music': 'MUSC',
            'Neuroscience': 'NEUR',
            'Philosophy': 'PHIL',
            'Physics': 'PHYS',
            'Political Science': 'POLI',
            'Psychology': 'PSYC',
            'Public  Health  Department': 'PHSC',
            'Scripture and Tradition (SCTR)': 'SCTR',
            'Theology, Ethics, and Spirituality (TESP)': 'TESP',
            'Religion and Society (RSOC)': 'RSOC',
            'Sociology': 'SOCI',
            'Theatre': 'THTR',
            'Dance': 'DANC',
            'Accounting': 'ACTG',
            'Finance': 'FNCE',
            'Management': 'MGMT',
            'Marketing': 'MKTG',
            'Information  Systems &  Analytics': 'OMIS',
            'Applied Mathematics': 'AMTH',
            'Bioengineering': 'BIOE',
            'Civil, Environmental, and Sustainable  Engineering': 'CENG',
            'Computer  Science  and  Engineering': 'CSEN',
            'Electrical and Computer Engineering': 'ECEN',
            'General Engineering': 'ENGR',
            'Mechanical  Engineering': 'MECH',
        }

        # Send a GET request to fetch the page content
        response = requests.get(self.base)
        
        # Check if the request was successful
        if response.status_code == 200:
            page_content = response.text
        else:
            print(f"Failed to retrieve content from {self.base}")
            exit()

        # Create a BeautifulSoup object to parse the HTML content
        soup = BeautifulSoup(page_content, 'html.parser')

    def _get_url_map(self):
        sidebar = self.soup.find_all('ul', class_='bltFolder')

        college_tag = {
            'CAS': sidebar[3],
            'LSB': sidebar[4],
            'SOE': sidebar[5]
        }

        url_map = {}
        skip = set([
            ' Medical  and  Health  Humanities ',
            ' Undergraduate Degrees',
            ' Centers Institutes and Special Programs'
        ])

        for college, tag in college_tag.items(): 
            for anchor in tag.find_all('a'):
                department = anchor.get_text().strip()
                if department in skip or not department:
                    continue

                url = self.base + anchor.get('href')[2:]
                url_map[(college, department)] = url

        return url_map

    def _get_course_info(self, soup: BeautifulSoup, college, department, show=False):
        content = soup.find('body', class_='doc-content')

        col = []
        dep = []
        num = []
        cou = []
        des = []
        tags = []
        
        # Initialize category and state
        if department.replace('  ', ' ') == 'Theatre and Dance':
            current_category = "Theatre"
            reached_dance = False
        elif department.replace('  ', ' ') == 'Mathematics and Computer Science':
            current_category = "Mathematics"
            is_cs_section = False
        else:
            current_category = department
            
        last_course_num = None
        print(f"\nProcessing {department} with initial category: {current_category}")

        # Process course info...
        language_keywords = re.compile(r'\b(Arabic|Chinese|French|German|Italian|Japanese|Spanish)\b', re.IGNORECASE)
        religious_studies_categories = {
            "Scripture and Tradition (SCTR)": re.compile(r'Scripture and Tradition', re.IGNORECASE),
            "Theology, Ethics, and Spirituality (TESP)": re.compile(r'Theology, Ethics, and Spirituality', re.IGNORECASE),
            "Religion and Society (RSOC)": re.compile(r'Religion and Society', re.IGNORECASE),
        }

        current_desc = ""
        last_course_index = -1
        
        for elm in content.children:
            if elm.name == 'h2':  # Detect section headers
                for category, pattern in religious_studies_categories.items():
                    if pattern.search(elm.get_text()):
                        current_category = category
                        print(f"Switching Religious Studies category to: {current_category}")
                        break

            if elm.name == 'p':  # Capture descriptions
                text = elm.get_text().strip()
                if text and last_course_index >= 0:
                    des[last_course_index] += " " + text

            if elm.name == 'h3':
                arr = elm.get_text().split('.')
                if len(arr) < 2:
                    continue

                number = arr[0].strip()
                course = '.'.join(arr[1:]).strip()

                if not re.match(r'^[0-9]+[A-Za-z]*$', number):
                    continue

                # Handle department splits
                if department.replace('  ', ' ') in ['Mathematics and Computer Science', 'Theatre and Dance']:
                    try:
                        base_num = int(re.match(r'^(\d+)', number).group(1))
                        
                        if department.replace('  ', ' ') == 'Theatre and Dance':
                            print(f"Processing course {number} (base_num: {base_num}, last: {last_course_num})")
                            
                            # Check for transition to Dance section
                            if base_num == 4 and not reached_dance and last_course_num and last_course_num > 100:
                                current_category = "Dance"
                                reached_dance = True
                                print(f"Switching to Dance at course {number}")
                            elif reached_dance:
                                current_category = "Dance"
                            else:
                                current_category = "Theatre"
                        elif department.replace('  ', ' ') == 'Mathematics and Computer Science':
                            if last_course_num and base_num < last_course_num - 50 and not is_cs_section:
                                current_category = "Computer Science"
                                is_cs_section = True
                                print(f"Switching to CS at number {base_num}")
                            elif is_cs_section:
                                current_category = "Computer Science"
                            else:
                                current_category = "Mathematics"
                        
                        last_course_num = base_num
                        print(f"Category is now: {current_category}")
                        
                    except Exception as e:
                        print(f"Error processing course {number}: {str(e)}")

                # Handle language studies categories
                elif department == 'Modern Languages and Literatures':
                    match = language_keywords.search(course)
                    if match:
                        current_category = match.group(0) + ' Studies'
                        print(f"Detected language: {current_category} for course {number}")
                
                col.append(college)
                dep.append(current_category)
                num.append(number)
                cou.append(course)
                des.append("")  # Placeholder for description
                # Get the course tag from the map
                tag = self.tag_map.get(current_category, '')
                tags.append(tag)
                last_course_index = len(des) - 1

        return col, dep, num, cou, des, tags

    def retrieve_course_df(self) -> pd.DataFrame:
        url_map = self._get_url_map()

        colleges = []
        departments = []
        numbers = []
        courses = []
        descriptions = []
        tags = []

        for (college, department), url in url_map.items():
            # Send a GET request to fetch the page content
            response = requests.get(url)

            # Check if the request was successful
            if response.status_code == 200:
                page_content = response.text
            else:
                print(f"Failed to retrieve content from {url}")
                exit()

            # Create a BeautifulSoup object to parse the HTML content
            soupObj = BeautifulSoup(page_content, 'html.parser')
            col, dep, num, cou, des, tag = self._get_course_info(soupObj, college, department)

            colleges += col
            departments += dep
            numbers += num 
            courses += cou
            descriptions += des
            tags += tag

        df = pd.DataFrame({
            'college': colleges,
            'department': departments,
            'number': numbers,
            'course': courses,
            'description': descriptions,
            'tag': tags
        })
        
        # Remove rows with missing course names and ensure valid course numbers
        df = df.dropna(subset=['course'])
        df = df[df['number'].str.match(r'^[0-9]+[A-Za-z]*$', na=False)]
        
        return df

def main():
    scraper = CourseScraper()
    df = scraper.retrieve_course_df()
    df.to_csv('data/courses.csv', index=False)
    print("Course data has been saved to 'data/courses.csv'")

if __name__ == "__main__":
    main()