import { useQuery } from '@tanstack/react-query';
import { siteNumbersService } from '../services/siteNumbersService';

export const SITE_NUMBERS_KEY = ['site-numbers'];

export const useSiteNumbers = () =>
  useQuery({ queryKey: SITE_NUMBERS_KEY, queryFn: siteNumbersService.get });
