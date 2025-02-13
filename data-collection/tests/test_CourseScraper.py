import unittest
import pandas as pd
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.CourseScraper import CourseScraper

expected_base = 'https://www.scu.edu/bulletin/undergraduate/'

expected_tag_map = {
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

class TestCourseScraper(unittest.TestCase):

    def setUp(self):
        self.scraper = CourseScraper()

    def test_initialization(self):
        self.assertEqual(self.scraper.base, expected_base)
        self.assertEqual(self.scraper.tag_map, expected_tag_map)

    def test_get_tag_map(self):
        actual_tag_map = self.scraper.tag_map
        self.assertEqual(actual_tag_map, expected_tag_map)

    def test_get_base(self):
        actual_base = self.scraper.get_base()
        self.assertEqual(actual_base, expected_base)

    def test_retrieve_course_df(self):
        actual_df = self.scraper.retrieve_course_df()
        self.assertIsInstance(actual_df, pd.DataFrame)

    def test_add_pre_reqs(self):
        df = self.scraper.retrieve_course_df() 
        actual_df = self.scraper.add_pre_reqs(df)
        self.assertIsInstance(actual_df, pd.DataFrame)


if __name__ == '__main__':
    unittest.main()
